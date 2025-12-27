package main

import (
	"fmt"
	"time"

	_ "github.com/joho/godotenv/autoload"
)

func main() {
	fmt.Println("Starting CoReader Worker...")
	db := InitDB()
	unprocessedFiles, err := db.GetUnprocessedFiles()
	llm := NewLLMClientFromEnv()
	if err != nil {
		fmt.Println("Error getting unprocessed files:", err)
	}
	for _, file := range unprocessedFiles {
		start := time.Now()
		fmt.Println("Processing file:", file.ID.Hex(), file.StoragePath)
		err := ProcessFile(db, &file, llm)
		if err != nil {
			fmt.Println("Error processing file:", file.ID.Hex(), err)
		} else {
			fmt.Println("Successfully processed file:", file.ID.Hex(), "in", time.Since(start))
		}
	}
	defer fmt.Println("Stopping CoReader Worker...")
	defer db.Close()
}
