package main

import (
	"context"
	"fmt"

	"go.mongodb.org/mongo-driver/bson"
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

func ProcessFile(db *DB, file *FilesDoc, llm *LLMClient) error {
	fileChunkChan := ReadFileInChunks(file.StoragePath, file.StorageName, CHUNK_SIZE_BYTES) // 1MB chunks
	var processedData []byte
	var totalChars int
	var totalChunks int
	// create book with known info, additional will be added later
	book, err := db.CreateBookDoc(&BooksDoc{
		FileID: file.ID,
	})
	if err != nil {
		return err
	}
	isFirstChunk := true
	for logicalChunk := range ReadLogicalChunks(fileChunkChan, ChunkingOptions{
		MinChars:          CHUNK_SIZE_CHARS,
		MaxLookaheadChars: MAX_ENDING_SEARCH_CHARS,
	}) {
		fmt.Printf("Appending %d chars\n", len(logicalChunk.Text))
		// Todo: send to llm for entity extraction
		currentChunkLength := len(logicalChunk.Text)
		totalChars += currentChunkLength
		totalChunks++

		_, err := db.CreateBookChunkDoc(&BookChunkDoc{
			BookID:       book.ID,
			Index:        totalChunks - 1,
			StartChar:    totalChars - currentChunkLength,
			EndChar:      totalChars,
			Text:         logicalChunk.Text, // replaces invalid with �
			LLMProcessed: false,
		})
		if err != nil {
			return err
		}
		if isFirstChunk {
			fmt.Println("Processing first chunk for book header metadata")
			isFirstChunk = false
			bookHeaderMetadata, err := llm.AnalyzeBookHeader(context.TODO(), logicalChunk.Text)
			if err != nil {
				return err
			}
			fmt.Printf("Book header metadata: %+v\n", bookHeaderMetadata)
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
		chunkEntities, err := llm.AnalyzeChunk(context.TODO(), book.Title, logicalChunk.Text)
		if err != nil {
			return err
		}
		fmt.Printf("Found %d entities in chunk %d\n", len(chunkEntities.Entities), totalChunks-1)
		processedData = append(processedData, []byte(logicalChunk.Text)...)
	}

	fmt.Println("Processed data length for file", file.ID.Hex(), ":", len(processedData))
	// Update file status in DB
	err = db.SetFileStatus(file.ID, "processed") // TODO: set to appropriate status
	if err != nil {
		return err
	}
	return nil
}
