package main

import (
	"fmt"
	"os"
	"path/filepath"
)

var /* const */ FILE_STORAGE_ROOT = GetEnvWithPanic("FILE_STORAGE_ROOT")

// Read File
func ReadFile(storagePath string, fileName string) ([]byte, error) {
	file, err := os.ReadFile(filepath.Join(FILE_STORAGE_ROOT, storagePath, fileName))
	if err != nil {
		return nil, err
	}
	return file, nil
}

type FileChunk struct {
	Error error
	Data  []byte
}

// Reads file in chunks returning a channel of byte slices
func ReadFileInChunks(storagePath string, fileName string, chunkSize int) <-chan FileChunk {
	fileChunkChan := make(chan FileChunk)
	go func() {
		defer close(fileChunkChan)
		filePath := filepath.Join(FILE_STORAGE_ROOT, storagePath, fileName)
		file, err := os.Open(filePath)
		if err != nil {
			fileChunkChan <- FileChunk{Error: err}
			return
		}
		defer file.Close()
		buf := make([]byte, chunkSize)
		for {
			n, err := file.Read(buf)
			fmt.Printf("Reading buffer of size %d, read %d bytes\n", chunkSize, n)
			if n > 0 {
				fmt.Printf("Sending %d bytes to dataChan\n", n)
				fileChunkChan <- FileChunk{Data: buf[:n]}
			}
			if err != nil {
				if err.Error() != "EOF" {
					fmt.Printf("Error reading file: %v\n", err)
					fileChunkChan <- FileChunk{Error: err}
				}
				fmt.Println("Reached end of file")
				return
			}
		}
	}()
	return fileChunkChan
}
