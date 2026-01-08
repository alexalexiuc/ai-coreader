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

	qdrantClient, err := InitQdrant()
	if err != nil {
		fmt.Printf("Error initializing Qdrant client: %v\n", err)
		return
	}
	defer func() {
		if err := qdrantClient.Close(); err != nil {
			fmt.Printf("Error closing Qdrant client: %v\n", err)
		}
	}()

	worker := NewWorker(db, llmClient, qdrantClient)

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
		err := worker.ProcessFile(ctx, &file)
		if err != nil {
			fmt.Println("Error processing file:", file.ID.Hex(), err)
		} else {
			fmt.Println("Successfully processed file:", file.ID.Hex(), "in", time.Since(start))
		}
	}

	worker.WatchFilesCollectionChanges(ctx)
}
