package main

import (
	"context"
	"coreader-worker/llm"
	"fmt"
	"log"
	"math"
	"path/filepath"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	CHUNK_SIZE_CHARS = 3000
	CHUNK_SIZE_BYTES = 3000 * 4 // UTF-8 can be up to 4 bytes per character
	// Max chars allowed to look for new lines when splitting
	MAX_ENDING_SEARCH_CHARS = 300
)

/*
	File processing.
	1. Read file
	2. Split file into chunks.
	3. Send each chunk to LLM to find any entities.
*/

func ProcessFile(ctx context.Context, db *DB, file *FilesDoc, llmClient llm.Client) error {
	llmSession := llmClient.NewSession(generateSessionID(file.StorageName))
	// Set processing started timestamp
	if err := db.SetFileProcessingStarted(file.ID); err != nil {
		log.Printf("Failed to set processing start time: %v", err)
	}

	fileChunkChan := ReadFileInChunks(file.StoragePath, file.StorageName, CHUNK_SIZE_BYTES) // 1MB chunks
	var processedData []byte
	var totalChars int
	var totalChunks int
	var processedBytes int
	type entityRecord struct {
		Name string
		Type string
		ID   primitive.ObjectID
	}
	insertedEntities := make([]entityRecord, 0)
	// create book with known info, additional will be added later
	book, err := db.CreateBookDoc(&BooksDoc{
		FileID:      file.ID,
		Processed:   false,
		TotalChars:  0,
		TotalChunks: 0,
		Source:      "user_upload",
	})
	if err != nil {
		errMsg := fmt.Sprintf("Failed to create book document: %v", err)
		log.Printf("Error: %s", errMsg)
		_ = db.SetFileError(file.ID, err.Error(), "Failed to create book record. Please try again.")
		_ = db.SetFileStatus(file.ID, "failed")
		return err
	}
	log.Printf("Processing file id=%s name=%q sizeBytes=%d bookId=%s", file.ID.Hex(), file.OriginalName, file.Size, book.ID.Hex())
	isFirstChunk := true

	if ctx.Err() != nil {
		log.Println("Shutdown signal received; aborting file processing.")
		_ = db.SetFileStatus(file.ID, "failed")
		return ctx.Err()
	}

	err = db.SetFileStatus(file.ID, "processing")
	if err != nil {
		errMsg := fmt.Sprintf("Failed to set file status: %v", err)
		log.Printf("Error: %s", errMsg)
		_ = db.SetFileError(file.ID, err.Error(), "Failed to update processing status.")
		return err
	}
	for logicalChunk := range ReadLogicalChunks(fileChunkChan, ChunkingOptions{
		MinChars:          CHUNK_SIZE_CHARS,
		MaxLookaheadChars: MAX_ENDING_SEARCH_CHARS,
	}) {
		if ctx.Err() != nil {
			log.Println("Shutdown signal received; stopping chunk processing.")
			_ = db.SetFileStatus(file.ID, "failed")
			return ctx.Err()
		}

		fmt.Printf("Appending %d chars\n", len(logicalChunk.Text))
		currentChunkLength := len(logicalChunk.Text)
		totalChars += currentChunkLength
		totalChunks++

		chunk, err := db.CreateBookChunkDoc(&BookChunksDoc{
			BookID:       book.ID,
			Index:        totalChunks - 1,
			StartChar:    totalChars - currentChunkLength,
			EndChar:      totalChars,
			Text:         logicalChunk.Text, // replaces invalid with �
			LlmProcessed: false,
		})
		if err != nil {
			errMsg := fmt.Sprintf("Failed to create chunk %d: %v", totalChunks-1, err)
			log.Printf("Error: %s", errMsg)
			_ = db.SetFileError(file.ID, err.Error(), "Failed to process file chunks.")
			_ = db.SetFileStatus(file.ID, "failed")
			return err
		}
		log.Printf("Chunk %d created (chars=%d)", totalChunks-1, currentChunkLength)
		if isFirstChunk {
			log.Println("Processing first chunk for book header metadata")
			isFirstChunk = false
			bookHeaderMetadata, err := llm.AnalyzeBookHeader(ctx, llmSession, logicalChunk.Text)
			if err != nil {
				errMsg := fmt.Sprintf("Failed to analyze book header: %v", err)
				log.Printf("Error: %s", errMsg)
				_ = db.SetFileError(file.ID, err.Error(), "Failed to analyze book header.")
				_ = db.SetFileStatus(file.ID, "failed")
				return err
			}
			log.Printf("Book header metadata: %+v", bookHeaderMetadata)
			if bookHeaderMetadata.HasHeader {
				_, err := db.UpdateBookDoc(book.ID, bson.M{
					"author": bookHeaderMetadata.Author,
					"title":  bookHeaderMetadata.Title,
				})
				if err != nil {
					return err
				}
				book.Author = bookHeaderMetadata.Author
				book.Title = bookHeaderMetadata.Title
			}
		}
		chunkEntities, err := llm.AnalyzeChunk(ctx, llmSession, book.Title, logicalChunk.Text)
		if err != nil {
			errMsg := fmt.Sprintf("Failed to analyze chunk %d: %v", totalChunks-1, err)
			log.Printf("Error: %s", errMsg)
			_ = db.SetFileError(file.ID, err.Error(), "Failed to analyze text chunks.")
			_ = db.SetFileStatus(file.ID, "failed")
			return err
		}
		log.Printf("Found %d entities in chunk %d", len(chunkEntities.Entities), totalChunks-1)

		// Store entities in the database collection and capture IDs on the chunk refs.
		entitiesWithIDs := make([]ChunkEntityRef, 0, len(chunkEntities.Entities))
		for _, llmEntity := range chunkEntities.Entities {
			entityID := primitive.NilObjectID
			for _, inserted := range insertedEntities {
				if inserted.Name == llmEntity.Name && inserted.Type == llmEntity.Type {
					entityID = inserted.ID
					break
				}
			}
			if entityID == primitive.NilObjectID {
				createdEntity, err := db.CreateEntityDescriptionDoc(&EntityDescriptionsDoc{
					BookID:      book.ID,
					BookChunkID: chunk.ID,
					Name:        llmEntity.Name,
					Type:        llmEntity.Type,
					Summary:     "", // Will be filled later with more detailed analysis
				})
				if err != nil {
					return err
				}
				entityID = createdEntity.ID
				insertedEntities = append(insertedEntities, entityRecord{
					Name: llmEntity.Name,
					Type: llmEntity.Type,
					ID:   createdEntity.ID,
				})
				log.Printf("Created new entity: %s (%s)", llmEntity.Name, llmEntity.Type)
			}
			// Convert llm.ChunkEntityRef to dbtypes ChunkEntityRef
			dbEntity := ChunkEntityRef{
				EntityID:                entityID,
				Name:                    llmEntity.Name,
				Type:                    llmEntity.Type,
				StartOffset:             llmEntity.StartOffset,
				EndOffset:               llmEntity.EndOffset,
				IsIntroducedInThisChunk: llmEntity.IsIntroducedInThisChunk,
			}
			entitiesWithIDs = append(entitiesWithIDs, dbEntity)
		}

		// Update book chunk with LLM metadata
		_, err = db.AddLLMDataToBookChunk(chunk.ID, entitiesWithIDs, chunkEntities)
		if err != nil {
			return err
		}

		processedData = append(processedData, []byte(logicalChunk.Text)...)
		processedBytes += len(logicalChunk.Text)
		if file.Size > 0 {
			progressPct := math.Floor((float64(processedBytes) / float64(file.Size)) * 100)
			if progressPct >= 100 {
				progressPct = 99
			}
			err = db.SetFileProgress(file.ID, progressPct)
			if err != nil {
				return err
			}
			log.Printf("Progress %0.f%% (chunk %d)", progressPct, totalChunks-1)
		}
	}

	if file.Size > 0 {
		err = db.SetFileProgress(file.ID, 100)
		if err != nil {
			return err
		}
	}

	fmt.Println("Processed data length for file", file.ID.Hex(), ":", len(processedData))
	// Update file status in DB
	err = db.SetFileStatus(file.ID, "processed")
	if err != nil {
		errMsg := fmt.Sprintf("Failed to set final status: %v", err)
		log.Printf("Error: %s", errMsg)
		_ = db.SetFileError(file.ID, err.Error(), "Failed to finalize processing status.")
		return err
	}

	_, err = db.SetBookProcessed(book.ID)
	if err != nil {
		errMsg := fmt.Sprintf("Failed to mark book as processed: %v", err)
		log.Printf("Error: %s", errMsg)
		_ = db.SetFileError(file.ID, err.Error(), "Failed to finalize book record.")
		return err
	}

	// Set processing completed timestamp
	if err := db.SetFileProcessingCompleted(file.ID); err != nil {
		log.Printf("Failed to set processing end time: %v", err)
	}

	log.Printf("Successfully completed processing file id=%s with bookId=%s", file.ID.Hex(), book.ID.Hex())
	return nil
}

// GenerateSessionID creates a unique session ID for a file processing event
// Format: filename_timestamp
func generateSessionID(filename string) string {
	sanitized := filepath.Base(filename)
	// Remove extension for cleaner logging
	ext := filepath.Ext(sanitized)
	name := sanitized[:len(sanitized)-len(ext)]

	timestamp := time.Now().Format("20060102_150405")
	return fmt.Sprintf("%s_%s", timestamp, name)
}
