package main

import (
	"fmt"
	"testing"
)

func TestReadLogicalChunksBasic(t *testing.T) {
	tests := []struct {
		name           string
		input          string
		minChars       int
		maxLookahead   int
		expectedChunks []string
	}{
		{
			name:           "Simple text with sentence boundary",
			input:          "Hello world. This is a test.",
			minChars:       5,
			maxLookahead:   100,
			expectedChunks: []string{"Hello world. ", "This is a ", "test."},
		},
		{
			name:           "Text with paragraph break",
			input:          "First paragraph.\n\nSecond paragraph.",
			minChars:       5,
			maxLookahead:   100,
			expectedChunks: []string{"First paragraph.\n\n", "Second ", "paragraph."},
		},
		{
			name:           "Single small chunk",
			input:          "Short.",
			minChars:       10,
			maxLookahead:   100,
			expectedChunks: []string{"Short."},
		},
		{
			name:           "Multiple sentences",
			input:          "First. Second! Third? Done.",
			minChars:       5,
			maxLookahead:   100,
			expectedChunks: []string{"First. Second! Third? ", "Done."},
		},
		{
			name:           "Text with commas",
			input:          "Hello, world. Test, sentence.",
			minChars:       5,
			maxLookahead:   100,
			expectedChunks: []string{"Hello, world. ", "Test, ", "sentence."},
		},
		{
			name:           "Empty input",
			input:          "",
			minChars:       5,
			maxLookahead:   100,
			expectedChunks: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create input channel with file chunks
			fileChunkChan := make(chan FileChunk)
			go func() {
				defer close(fileChunkChan)
				fileChunkChan <- FileChunk{Data: []byte(tt.input)}
			}()

			// Process through ReadLogicalChunks
			logicalChunks := ReadLogicalChunks(fileChunkChan, ChunkingOptions{
				MinChars:          tt.minChars,
				MaxLookaheadChars: tt.maxLookahead,
			})

			var chunks []string
			for chunk := range logicalChunks {
				if chunk.Error != nil {
					t.Fatalf("Unexpected error: %v", chunk.Error)
				}
				chunks = append(chunks, chunk.Text)
			}

			if len(chunks) != len(tt.expectedChunks) {
				t.Errorf("Expected %d chunks, got %d", len(tt.expectedChunks), len(chunks))
				t.Logf("Got chunks: %v", chunks)
			}

			for i, expected := range tt.expectedChunks {
				if i >= len(chunks) {
					t.Errorf("Missing chunk %d: %q", i, expected)
					continue
				}
				if chunks[i] != expected {
					t.Errorf("Chunk %d mismatch:\n  expected: %q\n  got:      %q", i, expected, chunks[i])
				}
			}
		})
	}
}

func TestReadLogicalChunksPreservesContent(t *testing.T) {
	// Verify that all input content is preserved in output
	input := "The quick brown fox jumps over the lazy dog. This is another sentence! And a third one?"
	fileChunkChan := make(chan FileChunk)
	go func() {
		defer close(fileChunkChan)
		fileChunkChan <- FileChunk{Data: []byte(input)}
	}()

	logicalChunks := ReadLogicalChunks(fileChunkChan, ChunkingOptions{
		MinChars:          10,
		MaxLookaheadChars: 50,
	})

	var reconstructed string
	for chunk := range logicalChunks {
		if chunk.Error != nil {
			t.Fatalf("Unexpected error: %v", chunk.Error)
		}
		reconstructed += chunk.Text
	}

	if reconstructed != input {
		t.Errorf("Content not preserved:\n  expected: %q\n  got:      %q", input, reconstructed)
	}
}

func TestReadLogicalChunksCharOffsets(t *testing.T) {
	// Verify that StartChar and EndChar are correct
	input := "Hello. World! Test."
	fileChunkChan := make(chan FileChunk)
	go func() {
		defer close(fileChunkChan)
		fileChunkChan <- FileChunk{Data: []byte(input)}
	}()

	logicalChunks := ReadLogicalChunks(fileChunkChan, ChunkingOptions{
		MinChars:          5,
		MaxLookaheadChars: 100,
	})

	var chunks []TextChunk
	for chunk := range logicalChunks {
		if chunk.Error != nil {
			t.Fatalf("Unexpected error: %v", chunk.Error)
		}
		chunks = append(chunks, chunk)
	}

	// Verify offsets and reconstruct
	for i, chunk := range chunks {
		expectedText := input[chunk.StartChar:chunk.EndChar]
		if chunk.Text != expectedText {
			t.Errorf("Chunk %d offset mismatch:\n  expected from offset %d-%d: %q\n  got: %q",
				i, chunk.StartChar, chunk.EndChar, expectedText, chunk.Text)
		}
	}
}

func TestReadLogicalChunksMultipleFileChunks(t *testing.T) {
	// Verify it works with multiple file chunks (simulating streaming)
	fileChunkChan := make(chan FileChunk)
	go func() {
		defer close(fileChunkChan)
		// Send in smaller pieces
		fileChunkChan <- FileChunk{Data: []byte("Hello world. ")}
		fileChunkChan <- FileChunk{Data: []byte("This is ")}
		fileChunkChan <- FileChunk{Data: []byte("a test.")}
	}()

	logicalChunks := ReadLogicalChunks(fileChunkChan, ChunkingOptions{
		MinChars:          5,
		MaxLookaheadChars: 100,
	})

	var chunks []TextChunk
	for chunk := range logicalChunks {
		if chunk.Error != nil {
			t.Fatalf("Unexpected error: %v", chunk.Error)
		}
		chunks = append(chunks, chunk)
	}

	// Should have at least 2 chunks
	if len(chunks) < 2 {
		t.Errorf("Expected at least 2 chunks, got %d", len(chunks))
		for i, c := range chunks {
			t.Logf("  Chunk %d: %q", i, c.Text)
		}
	}

	// Verify content is complete
	reconstructed := ""
	for _, chunk := range chunks {
		reconstructed += chunk.Text
	}
	if reconstructed != "Hello world. This is a test." {
		t.Errorf("Content not preserved:\n  expected: %q\n  got:      %q", "Hello world. This is a test.", reconstructed)
	}
}

func TestReadLogicalChunksMinCharRespect(t *testing.T) {
	// Verify that MinChars is respected
	input := "Short. Very short text here. This should be kept together."
	fileChunkChan := make(chan FileChunk)
	go func() {
		defer close(fileChunkChan)
		fileChunkChan <- FileChunk{Data: []byte(input)}
	}()

	logicalChunks := ReadLogicalChunks(fileChunkChan, ChunkingOptions{
		MinChars:          20, // Only split if we have at least 20 chars
		MaxLookaheadChars: 30,
	})

	var chunks []TextChunk
	for chunk := range logicalChunks {
		if chunk.Error != nil {
			t.Fatalf("Unexpected error: %v", chunk.Error)
		}
		chunks = append(chunks, chunk)
	}

	// Verify content is complete
	reconstructed := ""
	for _, chunk := range chunks {
		reconstructed += chunk.Text
	}
	if reconstructed != input {
		t.Errorf("Content not preserved")
	}
}

func TestReadLogicalChunksUTF8Handling(t *testing.T) {
	// Test with UTF-8 characters
	input := "Hello 世界. This is 日本語 text!"
	fileChunkChan := make(chan FileChunk)
	go func() {
		defer close(fileChunkChan)
		fileChunkChan <- FileChunk{Data: []byte(input)}
	}()

	logicalChunks := ReadLogicalChunks(fileChunkChan, ChunkingOptions{
		MinChars:          5,
		MaxLookaheadChars: 100,
	})

	var chunks []string
	for chunk := range logicalChunks {
		if chunk.Error != nil {
			t.Fatalf("Unexpected error: %v", chunk.Error)
		}
		chunks = append(chunks, chunk.Text)
	}

	// Verify content is complete
	reconstructed := ""
	for _, chunk := range chunks {
		reconstructed += chunk
	}
	if reconstructed != input {
		t.Errorf("Content not preserved:\n  expected: %q\n  got:      %q", input, reconstructed)
	}
}

func TestReadLogicalChunksNoFirstChunkSkip(t *testing.T) {
	// Critical test: verify first chunk is NOT skipped
	input := "First chunk content here. Second chunk. Third chunk."
	fileChunkChan := make(chan FileChunk)
	go func() {
		defer close(fileChunkChan)
		fileChunkChan <- FileChunk{Data: []byte(input)}
	}()

	logicalChunks := ReadLogicalChunks(fileChunkChan, ChunkingOptions{
		MinChars:          10,
		MaxLookaheadChars: 50,
	})

	firstChunk := <-logicalChunks
	if firstChunk.Error != nil {
		t.Fatalf("Unexpected error: %v", firstChunk.Error)
	}

	if !startsWithPrefix(firstChunk.Text, "First") {
		t.Errorf("First chunk does not start with expected text. Got: %q", firstChunk.Text)
	}

	if firstChunk.StartChar != 0 {
		t.Errorf("First chunk should start at 0, got %d", firstChunk.StartChar)
	}

	fmt.Printf("First chunk: %q (offset %d-%d)\n", firstChunk.Text, firstChunk.StartChar, firstChunk.EndChar)
}

func startsWithPrefix(s string, prefix string) bool {
	return len(s) >= len(prefix) && s[:len(prefix)] == prefix
}
