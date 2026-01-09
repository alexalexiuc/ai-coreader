package main

import (
	"context"
	"coreader-worker/llm"
	"coreader-worker/utils"
	"fmt"
	"log"
	"math"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	CHUNK_SIZE_CHARS = 1500
	CHUNK_SIZE_BYTES = CHUNK_SIZE_CHARS * 4 // UTF-8 can be up to 4 bytes per character
	// Max chars allowed to look for new lines when splitting
	MAX_ENDING_SEARCH_CHARS = CHUNK_SIZE_CHARS / 10
)

// chapterOccurrence tracks where a chapter heading was found during processing
type chapterOccurrence struct {
	Name        string
	ChunkID     primitive.ObjectID
	StartOffset int // character offset in the entire book where chapter name appears
}

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

	// Track chapters found across all chunks
	allChapterOccurrences := make([]chapterOccurrence, 0)

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

		// Collect chapter occurrences
		if len(chunkEntities.Chapters) > 0 {
			log.Printf("Found %d chapter(s) in chunk %d: %v", len(chunkEntities.Chapters), totalChunks-1, chunkEntities.Chapters)
			chunkStartInBook := totalChars - currentChunkLength
			for _, chapterName := range chunkEntities.Chapters {
				// Find where this chapter name appears in the chunk text
				chapterPosInChunk := strings.Index(logicalChunk.Text, chapterName)
				if chapterPosInChunk == -1 {
					// Fallback to chunk start if not found
					chapterPosInChunk = 0
					log.Printf("Warning: Chapter %q not found in chunk text, using chunk start", chapterName)
				}
				allChapterOccurrences = append(allChapterOccurrences, chapterOccurrence{
					Name:        chapterName,
					ChunkID:     chunk.ID,
					StartOffset: chunkStartInBook + chapterPosInChunk,
				})
			}
		}

		// Process entities: generate deterministic IDs and create mention records.
		// EntityDescriptions will be created later in PostProcess from aggregated mentions.
		entitiesWithIDs := make([]ChunkEntityRef, 0, len(chunkEntities.Entities))
		for _, llmEntity := range chunkEntities.Entities {
			// Generate deterministic entity ID from bookId + name + type
			entityID := utils.GenerateEntityID(book.ID, llmEntity.Name, llmEntity.Type)

			// Track for deduplication within this file processing session
			alreadyTracked := false
			for _, inserted := range insertedEntities {
				if inserted.ID == entityID {
					alreadyTracked = true
					break
				}
			}
			if !alreadyTracked {
				insertedEntities = append(insertedEntities, entityRecord{
					Name: llmEntity.Name,
					Type: llmEntity.Type,
					ID:   entityID,
				})
				log.Printf("Tracking entity: %s (%s) with ID %s", llmEntity.Name, llmEntity.Type, entityID.Hex())
			}

			// Create EntityMention records for each occurrence
			startOffsets := llmEntity.StartOffsets
			if startOffsets == nil {
				startOffsets = []int{}
			}

			for _, offset := range startOffsets {
				snippet, snippetStart, snippetEnd := snippetAroundOffset(logicalChunk.Text, offset, 250)
				mention := &EntityMentionsDoc{
					BookID:             book.ID,
					EntityID:           entityID,
					ChunkID:            chunk.ID,
					ChunkIndex:         totalChunks - 1,
					SurfaceForm:        strings.TrimSpace(llmEntity.Name),
					OffsetStart:        offset,
					Snippet:            snippet,
					SnippetStartOffset: snippetStart,
					SnippetEndOffset:   snippetEnd,
				}

				created, err := w.db.CreateEntityMentionDocIgnoreDuplicate(ctx, mention)
				if err != nil {
					return &ErrorInfo{
						RawError:        fmt.Errorf("failed to create entity mention: %w", err),
						FriendlyMessage: "Failed to create entity mention",
						BookID:          &bookID,
					}
				}
				if created {
					log.Printf("Created mention for entity %s at offset %d in chunk %d", llmEntity.Name, offset, totalChunks-1)
				}
			}

			// Store entity reference in chunk for fast rendering
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

	// Deduplicate chapters and pick middle occurrence
	finalChapters := deduplicateChapters(allChapterOccurrences)
	log.Printf("Final chapters after deduplication: %d chapters", len(finalChapters))

	// Update book with chapters
	if len(finalChapters) > 0 {
		_, err = w.db.UpdateBookDoc(book.ID, bson.M{
			"chapters": finalChapters,
		})
		if err != nil {
			return &ErrorInfo{
				RawError:        fmt.Errorf("failed to update book with chapters: %w", err),
				FriendlyMessage: "Failed to store chapters",
				BookID:          &bookID,
			}
		}
		log.Printf("Stored %d chapters in book document", len(finalChapters))
	}

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

	// Post-process entity descriptions after the book is fully chunked and persisted.
	// This is intentionally non-fatal: chunk/book persistence is the primary output,
	// and entity summaries can be safely re-run later due to idempotent mention upserts.
	//
	// ARCHITECTURAL NOTE: See entity_postprocess.go header comment for discussion of
	// data flow and architectural inconsistencies between this function (Worker method
	// with direct DB access) vs PostProcess (standalone function with interfaces).
	if err := PostProcessEntityDescriptions(ctx, w.db, book.ID, w.llmClient); err != nil {
		log.Printf("Warning: entity post-processing failed bookId=%s: %v", book.ID.Hex(), err)
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

// deduplicateChapters processes all chapter occurrences and returns a deduplicated list.
// When a chapter name appears multiple times, it picks the middle occurrence to avoid
// table of contents at the beginning or end of the book.
func deduplicateChapters(occurrences []chapterOccurrence) []struct {
	Name        string             `bson:"name" json:"name"`
	ChunkID     primitive.ObjectID `bson:"chunkId" json:"chunkId"`
	StartOffset int                `bson:"startOffset" json:"startOffset"`
} {
	if len(occurrences) == 0 {
		return []struct {
			Name        string             `bson:"name" json:"name"`
			ChunkID     primitive.ObjectID `bson:"chunkId" json:"chunkId"`
			StartOffset int                `bson:"startOffset" json:"startOffset"`
		}{}
	}

	// Group occurrences by chapter name
	byName := make(map[string][]chapterOccurrence)
	for _, occ := range occurrences {
		byName[occ.Name] = append(byName[occ.Name], occ)
	}

	result := make([]struct {
		Name        string             `bson:"name" json:"name"`
		ChunkID     primitive.ObjectID `bson:"chunkId" json:"chunkId"`
		StartOffset int                `bson:"startOffset" json:"startOffset"`
	}, 0, len(byName))
	for _, occs := range byName {
		// Pick the middle occurrence
		// TODO: Improve by verifying if there are dupes and chunk has more than one chapters, it is most probably table of content of hte book, so we pick the other than the first or last
		middleIdx := len(occs) / 2
		chosen := occs[middleIdx]

		result = append(result, struct {
			Name        string             `bson:"name" json:"name"`
			ChunkID     primitive.ObjectID `bson:"chunkId" json:"chunkId"`
			StartOffset int                `bson:"startOffset" json:"startOffset"`
		}{
			Name:        chosen.Name,
			ChunkID:     chosen.ChunkID,
			StartOffset: chosen.StartOffset,
		})
	}

	// Sort by start offset to maintain chapter order
	sort.Slice(result, func(i, j int) bool {
		return result[i].StartOffset < result[j].StartOffset
	})

	return result
}
