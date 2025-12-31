package main

import (
	"context"
	"fmt"
	"os/signal"
	"syscall"
	"time"

	"coreader-worker/llm"

	_ "github.com/joho/godotenv/autoload"
)

func main() {
	fmt.Println("Starting CoReader Worker...")

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	db := InitDB()
	defer func() {
		fmt.Println("Stopping CoReader Worker...")
		db.Close()
	}()

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
		if ctx.Err() != nil {
			fmt.Println("Shutdown signal received; stopping initial processing loop.")
			return
		}

		start := time.Now()
		fmt.Println("Processing file:", file.ID.Hex(), file.StoragePath)
		err := ProcessFile(db, &file, llmClient)
		if err != nil {
			fmt.Println("Error processing file:", file.ID.Hex(), err)
		} else {
			fmt.Println("Successfully processed file:", file.ID.Hex(), "in", time.Since(start))
		}
	}

	WatchFilesCollectionChanges(ctx, db, llmClient)
}
