package main

import (
	"fmt"
	"time"

	"coreader-worker/llm"

	_ "github.com/joho/godotenv/autoload"
)

func main() {
	fmt.Println("Starting CoReader Worker...")
	db := InitDB()
	llmClient, err := llm.NewClientFromEnv()
	if err != nil {
		fmt.Printf("Error initializing LLM client: %v\n", err)
		return
	}
	unprocessedFiles, err := db.GetUnprocessedFiles()
	if err != nil {
		fmt.Println("Error getting unprocessed files:", err)
		return
	}
	for _, file := range unprocessedFiles {
		start := time.Now()
		fmt.Println("Processing file:", file.ID.Hex(), file.StoragePath)
		err := ProcessFile(db, &file, llmClient)
		if err != nil {
			fmt.Println("Error processing file:", file.ID.Hex(), err)
		} else {
			fmt.Println("Successfully processed file:", file.ID.Hex(), "in", time.Since(start))
		}
	}
	defer fmt.Println("Stopping CoReader Worker...")
	defer db.Close()

	WatchFilesCollectionChanges(db, llmClient)
}
