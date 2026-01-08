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

// ErrorInfo contains both technical and user-friendly error information
type ErrorInfo struct {
	RawError        error
	FriendlyMessage string
	BookID          *primitive.ObjectID
}

/*
	File processing.
	1. Read file
	2. Split file into chunks.
	3. Send each chunk to LLM to find any entities.
*/

// ProcessFile orchestrates file processing and handles error recording
func (w *Worker) ProcessFile(ctx context.Context, file *FilesDoc) error {
	if err := w.db.SetFileProcessingStarted(file.ID); err != nil {
		log.Printf("Failed to set processing start time: %v", err)
	}

	// Call the actual processing logic
	err := w.processFileInternal(ctx, file)

	// Handle the result - update DB regardless of success or failure
	if err != nil {
		log.Printf("File processing failed for id=%s: %v", file.ID.Hex(), err)
		if err.BookID != nil {
			if cleanupErr := w.db.DeleteBookData(*err.BookID); cleanupErr != nil {
				log.Printf("Failed to cleanup book data for file id=%s bookId=%s: %v", file.ID.Hex(), err.BookID.Hex(), cleanupErr)
			}
		}
		// Append error to the error history array
		_ = w.db.AppendFileError(file.ID, err.RawError.Error(), err.FriendlyMessage)
		_ = w.db.SetFileStatus(file.ID, "failed")
		return err.RawError
	}

	// Set processing completed timestamp
	if err := w.db.SetFileProcessingCompleted(file.ID); err != nil {
		log.Printf("Failed to set processing end time: %v", err)
	}

	log.Printf("Successfully completed processing file id=%s", file.ID.Hex())
	return nil
}

// processFileInternal contains the core file processing logic without error handling
func (w *Worker) processFileInternal(ctx context.Context, file *FilesDoc) *ErrorInfo {
	ctx = llm.WithRequestLogger(ctx, generateSessionID(file.StorageName))

	type entityRecord struct {
		Name string
		Type string
		ID   primitive.ObjectID
	}
	insertedEntities := make([]entityRecord, 0)

	// Create book with known info, additional will be added later
	book, err := w.db.CreateBookDoc(&BooksDoc{
		FileID:      file.ID,
		Processed:   false,
		TotalChars:  0,
		TotalChunks: 0,
		Source:      "user_upload",
	})
	if err != nil {
		return &ErrorInfo{
			RawError:        fmt.Errorf("failed to create book document: %w", err),
			FriendlyMessage: "Failed to create book document",
		}
	}
	bookID := book.ID

	log.Printf("Processing file id=%s name=%q sizeBytes=%d bookId=%s", file.ID.Hex(), file.OriginalName, file.Size, book.ID.Hex())

	// Create user-book link if file has a userId (user-uploaded file)
	if !file.UserID.IsZero() {
		_, created, err := w.db.CreateOrUpdateUserBook(file.UserID, book.ID)
		if err != nil {
			log.Printf("Warning: Failed to create user-book link for userId=%s bookId=%s: %v", file.UserID.Hex(), book.ID.Hex(), err)
			// Non-fatal: continue processing even if link creation fails
		} else {
			action := "Updated"
			if created {
				action = "Created"
			}
			log.Printf("%s user-book link for userId=%s bookId=%s", action, file.UserID.Hex(), book.ID.Hex())
		}
	}

	if ctx.Err() != nil {
		return &ErrorInfo{
			RawError:        fmt.Errorf("shutdown signal before chunk processing: %w", ctx.Err()),
			FriendlyMessage: "Processing was interrupted",
			BookID:          &bookID,
		}
	}

	fileChunkChan := ReadFileInChunks(file.StoragePath, file.StorageName, CHUNK_SIZE_BYTES)
	var processedData []byte
	var totalChars int
	var totalChunks int
	var processedBytes int
	isFirstChunk := true

	for logicalChunk := range ReadLogicalChunks(fileChunkChan, ChunkingOptions{
		MinChars:          CHUNK_SIZE_CHARS,
		MaxLookaheadChars: MAX_ENDING_SEARCH_CHARS,
	}) {
		if ctx.Err() != nil {
			return &ErrorInfo{
				RawError:        fmt.Errorf("shutdown signal during chunk processing: %w", ctx.Err()),
				FriendlyMessage: "Processing was interrupted",
				BookID:          &bookID,
			}
		}

		fmt.Printf("Appending %d chars\n", len(logicalChunk.Text))
		currentChunkLength := len(logicalChunk.Text)
		totalChars += currentChunkLength
		totalChunks++ // Increment first, so totalChunks-1 is the current 0-based chunk index

		chunk, err := w.db.CreateBookChunkDoc(&BookChunksDoc{
			BookID:       book.ID,
			Index:        totalChunks - 1,
			StartChar:    totalChars - currentChunkLength,
			EndChar:      totalChars,
			Text:         logicalChunk.Text, // replaces invalid with �
			LlmProcessed: false,
		})
		if err != nil {
			return &ErrorInfo{
				RawError:        fmt.Errorf("failed to create chunk %d: %w", totalChunks-1, err),
				FriendlyMessage: "Failed to create chunk",
				BookID:          &bookID,
			}
		}
		log.Printf("Chunk %d created (chars=%d)", totalChunks-1, currentChunkLength)

		// Generate and store embedding for the chunk
		embedding, err := llm.GenerateEmbedding(ctx, w.llmClient, logicalChunk.Text)
		if err != nil {
			return &ErrorInfo{
				RawError:        fmt.Errorf("failed to generate embedding for chunk %d: %w", totalChunks-1, err),
				FriendlyMessage: "Failed to generate chunk embedding",
				BookID:          &bookID,
			}
		}
		log.Printf("Generated embedding for chunk %d (dimension: %d)", totalChunks-1, len(embedding))

		// Store embedding in Qdrant
		err = w.qdrantClient.StoreChunkEmbedding(ctx, book.ID, chunk.ID, totalChunks-1, embedding)
		if err != nil {
			return &ErrorInfo{
				RawError:        fmt.Errorf("failed to store embedding for chunk %d: %w", totalChunks-1, err),
				FriendlyMessage: "Failed to store chunk embedding",
				BookID:          &bookID,
			}
		}
		log.Printf("Stored embedding in Qdrant for chunk %d", totalChunks-1)

		if isFirstChunk {
			log.Println("Processing first chunk for book header metadata")
			isFirstChunk = false
			bookHeaderMetadata, err := llm.AnalyzeBookHeader(ctx, w.llmClient, logicalChunk.Text)
			if err != nil {
				return &ErrorInfo{
					RawError:        fmt.Errorf("failed to analyze book header: %w", err),
					FriendlyMessage: "Failed to analyze book header",
					BookID:          &bookID,
				}
			}
			log.Printf("Book header metadata: %+v", bookHeaderMetadata)
			if bookHeaderMetadata.HasHeader {
				_, err := w.db.UpdateBookDoc(book.ID, bson.M{
					"author": bookHeaderMetadata.Author,
					"title":  bookHeaderMetadata.Title,
				})
				if err != nil {
					return &ErrorInfo{
						RawError:        fmt.Errorf("failed to update book metadata: %w", err),
						FriendlyMessage: "Failed to update book metadata",
						BookID:          &bookID,
					}
				}
				book.Author = bookHeaderMetadata.Author
				book.Title = bookHeaderMetadata.Title
			}
		}

		chunkEntities, err := llm.AnalyzeChunk(ctx, w.llmClient, book.Title, logicalChunk.Text)
		if err != nil {
			return &ErrorInfo{
				RawError:        fmt.Errorf("failed to analyze chunk %d: %w", totalChunks-1, err),
				FriendlyMessage: "Failed to analyze chunk",
				BookID:          &bookID,
			}
		}
		log.Printf("Found %d entities in chunk %d", len(chunkEntities.Entities), totalChunks-1)

		// Store entities in the database collection and capture IDs on the chunk refs.
		entitiesWithIDs := make([]ChunkEntityRef, 0, len(chunkEntities.Entities))
		for _, llmEntity := range chunkEntities.Entities {
			entityID := primitive.NilObjectID
			entityCreated := false
			for _, inserted := range insertedEntities {
				if inserted.Name == llmEntity.Name && inserted.Type == llmEntity.Type {
					entityID = inserted.ID
					break
				}
			}
			if entityID == primitive.NilObjectID {
				createdEntity, err := w.db.CreateEntityDescriptionDoc(&EntityDescriptionsDoc{
					BookID:       book.ID,
					BookChunkID:  chunk.ID,
					BookChunkIds: []primitive.ObjectID{chunk.ID},
					Name:         llmEntity.Name,
					Type:         llmEntity.Type,
					Summary:      "", // Will be filled later with more detailed analysis
				})
				if err != nil {
					return &ErrorInfo{
						RawError:        fmt.Errorf("failed to create entity description: %w", err),
						FriendlyMessage: "Failed to create entity description",
						BookID:          &bookID,
					}
				}
				entityID = createdEntity.ID
				insertedEntities = append(insertedEntities, entityRecord{
					Name: llmEntity.Name,
					Type: llmEntity.Type,
					ID:   createdEntity.ID,
				})
				log.Printf("Created new entity: %s (%s)", llmEntity.Name, llmEntity.Type)
				entityCreated = true
			}

			if !entityCreated {
				if err := w.db.AddChunkToEntityDescription(entityID, chunk.ID); err != nil {
					return &ErrorInfo{
						RawError:        fmt.Errorf("failed to update entity chunk references: %w", err),
						FriendlyMessage: "Failed to update entity references",
						BookID:          &bookID,
					}
				}
			}

			startOffsets := llmEntity.StartOffsets
			if startOffsets == nil {
				startOffsets = []int{}
			}
			dbEntity := ChunkEntityRef{
				EntityID:     entityID,
				Name:         llmEntity.Name,
				Type:         llmEntity.Type,
				StartOffsets: startOffsets,
			}
			entitiesWithIDs = append(entitiesWithIDs, dbEntity)
		}

		// Update book chunk with LLM metadata
		_, err = w.db.AddLLMDataToBookChunk(chunk.ID, entitiesWithIDs, chunkEntities)
		if err != nil {
			return &ErrorInfo{
				RawError:        fmt.Errorf("failed to add LLM data to book chunk: %w", err),
				FriendlyMessage: "Failed to add LLM data to book chunk",
				BookID:          &bookID,
			}
		}

		processedData = append(processedData, []byte(logicalChunk.Text)...)
		processedBytes += len(logicalChunk.Text)
		if file.Size > 0 {
			progressPct := math.Floor((float64(processedBytes) / float64(file.Size)) * 100)
			if progressPct >= 100 {
				progressPct = 99
			}
			err = w.db.SetFileProgress(file.ID, progressPct)
			if err != nil {
				return &ErrorInfo{
					RawError:        fmt.Errorf("failed to set file progress: %w", err),
					FriendlyMessage: "Failed to update file progress",
					BookID:          &bookID,
				}
			}
			log.Printf("Progress %0.f%% (chunk %d)", progressPct, totalChunks-1)
		}
	}

	if file.Size > 0 {
		err = w.db.SetFileProgress(file.ID, 100)
		if err != nil {
			return &ErrorInfo{
				RawError:        fmt.Errorf("failed to set final progress: %w", err),
				FriendlyMessage: "Failed to update final progress",
				BookID:          &bookID,
			}
		}
	}

	fmt.Println("Processed data length for file", file.ID.Hex(), ":", len(processedData))

	_, err = w.db.SetBookProcessed(book.ID)
	if err != nil {
		return &ErrorInfo{
			RawError:        fmt.Errorf("failed to mark book as processed: %w", err),
			FriendlyMessage: "Failed to finalize book record",
			BookID:          &bookID,
		}
	}

	// Update file status in DB
	err = w.db.SetFileStatus(file.ID, "processed")
	if err != nil {
		return &ErrorInfo{
			RawError:        fmt.Errorf("failed to set final status: %w", err),
			FriendlyMessage: "Failed to finalize processing status",
			BookID:          &bookID,
		}
	}

	log.Printf("Successfully completed processing file id=%s with bookId=%s", file.ID.Hex(), book.ID.Hex())
	return nil
}

// contains checks if a string contains a substring (case-insensitive helper)
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) &&
		(s[:len(substr)] == substr || s[len(s)-len(substr):] == substr ||
			containsSubstring(s, substr)))
}

func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
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
