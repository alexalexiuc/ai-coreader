package main

import (
	"bytes"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"
)

func TestReadFileInChunksBasic(t *testing.T) {
	// Create a temporary directory and file for testing
	tmpDir, err := ioutil.TempDir("", "test_chunks_")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Set up test by overriding FILE_STORAGE_ROOT temporarily
	originalRoot := FILE_STORAGE_ROOT
	FILE_STORAGE_ROOT = tmpDir
	defer func() { FILE_STORAGE_ROOT = originalRoot }()

	tests := []struct {
		name      string
		content   []byte
		chunkSize int
		wantChunks []int // expected sizes of each chunk
	}{
		{
			name:      "Single chunk smaller than chunk size",
			content:   []byte("Hello, World!"),
			chunkSize: 1024,
			wantChunks: []int{13},
		},
		{
			name:      "Multiple chunks of exact size",
			content:   []byte("ABCDEFGHIJ"), // 10 bytes
			chunkSize: 5,
			wantChunks: []int{5, 5},
		},
		{
			name:      "Multiple chunks with remainder",
			content:   []byte("ABCDEFGHIJK"), // 11 bytes
			chunkSize: 5,
			wantChunks: []int{5, 5, 1},
		},
		{
			name:      "Chunk size of 1",
			content:   []byte("ABC"),
			chunkSize: 1,
			wantChunks: []int{1, 1, 1},
		},
		{
			name:      "Large content",
			content:   bytes.Repeat([]byte("X"), 10000),
			chunkSize: 1024,
			wantChunks: []int{1024, 1024, 1024, 1024, 1024, 1024, 1024, 1024, 1024, 784},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create test file
			subdir := filepath.Join(tmpDir, "test")
			if err := os.MkdirAll(subdir, 0755); err != nil {
				t.Fatalf("Failed to create subdir: %v", err)
			}

			filePath := filepath.Join(subdir, "testfile.txt")
			if err := ioutil.WriteFile(filePath, tt.content, 0644); err != nil {
				t.Fatalf("Failed to write test file: %v", err)
			}

			// Read file in chunks
			fileChunkChan := ReadFileInChunks("test", "testfile.txt", tt.chunkSize)

			var chunks [][]byte
			for fc := range fileChunkChan {
				if fc.Error != nil {
					t.Fatalf("Unexpected error: %v", fc.Error)
				}
				chunks = append(chunks, fc.Data)
			}

			// Verify chunk sizes
			if len(chunks) != len(tt.wantChunks) {
				t.Errorf("Expected %d chunks, got %d", len(tt.wantChunks), len(chunks))
			}

			for i, wantSize := range tt.wantChunks {
				if i >= len(chunks) {
					t.Errorf("Missing chunk %d", i)
					continue
				}
				if len(chunks[i]) != wantSize {
					t.Errorf("Chunk %d: expected size %d, got %d", i, wantSize, len(chunks[i]))
				}
			}

			// Verify all content is recovered
			var reconstructed []byte
			for _, chunk := range chunks {
				reconstructed = append(reconstructed, chunk...)
			}

			if !bytes.Equal(reconstructed, tt.content) {
				t.Errorf("Content mismatch:\n  expected: %q\n  got:      %q", tt.content, reconstructed)
			}
		})
	}
}

func TestReadFileInChunksEmptyFile(t *testing.T) {
	tmpDir, err := ioutil.TempDir("", "test_empty_")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	originalRoot := FILE_STORAGE_ROOT
	FILE_STORAGE_ROOT = tmpDir
	defer func() { FILE_STORAGE_ROOT = originalRoot }()

	// Create empty file
	subdir := filepath.Join(tmpDir, "test")
	if err := os.MkdirAll(subdir, 0755); err != nil {
		t.Fatalf("Failed to create subdir: %v", err)
	}

	filePath := filepath.Join(subdir, "empty.txt")
	if err := ioutil.WriteFile(filePath, []byte{}, 0644); err != nil {
		t.Fatalf("Failed to write empty file: %v", err)
	}

	// Read empty file
	fileChunkChan := ReadFileInChunks("test", "empty.txt", 1024)

	var chunks [][]byte
	for fc := range fileChunkChan {
		if fc.Error != nil {
			t.Fatalf("Unexpected error: %v", fc.Error)
		}
		chunks = append(chunks, fc.Data)
	}

	// Empty file should result in no chunks
	if len(chunks) != 0 {
		t.Errorf("Expected 0 chunks for empty file, got %d", len(chunks))
	}
}

func TestReadFileInChunksFileNotFound(t *testing.T) {
	tmpDir, err := ioutil.TempDir("", "test_notfound_")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	originalRoot := FILE_STORAGE_ROOT
	FILE_STORAGE_ROOT = tmpDir
	defer func() { FILE_STORAGE_ROOT = originalRoot }()

	// Try to read non-existent file
	fileChunkChan := ReadFileInChunks("test", "nonexistent.txt", 1024)

	gotError := false
	for fc := range fileChunkChan {
		if fc.Error != nil {
			gotError = true
			if !os.IsNotExist(fc.Error) {
				t.Errorf("Expected 'not exist' error, got: %v", fc.Error)
			}
		}
	}

	if !gotError {
		t.Error("Expected error for non-existent file, but got none")
	}
}

func TestReadFileInChunksPreservesAllData(t *testing.T) {
	tmpDir, err := ioutil.TempDir("", "test_preserve_")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	originalRoot := FILE_STORAGE_ROOT
	FILE_STORAGE_ROOT = tmpDir
	defer func() { FILE_STORAGE_ROOT = originalRoot }()

	// Create file with specific pattern
	content := []byte("The quick brown fox jumps over the lazy dog. " +
		"Pack my box with five dozen liquor jugs. " +
		"How vexingly quick daft zebras jump! " +
		"The five boxing wizards jump quickly.")

	subdir := filepath.Join(tmpDir, "test")
	if err := os.MkdirAll(subdir, 0755); err != nil {
		t.Fatalf("Failed to create subdir: %v", err)
	}

	filePath := filepath.Join(subdir, "pangrams.txt")
	if err := ioutil.WriteFile(filePath, content, 0644); err != nil {
		t.Fatalf("Failed to write test file: %v", err)
	}

	// Read with various chunk sizes
	for _, chunkSize := range []int{10, 33, 64, 128, 256} {
		t.Run(("ChunkSize_" + string(rune(chunkSize))), func(t *testing.T) {
			fileChunkChan := ReadFileInChunks("test", "pangrams.txt", chunkSize)

			var reconstructed []byte
			for fc := range fileChunkChan {
				if fc.Error != nil {
					t.Fatalf("Unexpected error: %v", fc.Error)
				}
				reconstructed = append(reconstructed, fc.Data...)
			}

			if !bytes.Equal(reconstructed, content) {
				t.Errorf("Content mismatch with chunk size %d", chunkSize)
				t.Logf("  expected length: %d", len(content))
				t.Logf("  got length: %d", len(reconstructed))
			}
		})
	}
}

func TestReadFileInChunksNoDataLoss(t *testing.T) {
	tmpDir, err := ioutil.TempDir("", "test_loss_")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	originalRoot := FILE_STORAGE_ROOT
	FILE_STORAGE_ROOT = tmpDir
	defer func() { FILE_STORAGE_ROOT = originalRoot }()

	// Create file with binary data (includes null bytes)
	content := make([]byte, 1000)
	for i := 0; i < len(content); i++ {
		content[i] = byte(i % 256)
	}

	subdir := filepath.Join(tmpDir, "test")
	if err := os.MkdirAll(subdir, 0755); err != nil {
		t.Fatalf("Failed to create subdir: %v", err)
	}

	filePath := filepath.Join(subdir, "binary.bin")
	if err := ioutil.WriteFile(filePath, content, 0644); err != nil {
		t.Fatalf("Failed to write test file: %v", err)
	}

	// Read file
	fileChunkChan := ReadFileInChunks("test", "binary.bin", 47) // prime number to test boundary conditions

	var reconstructed []byte
	var chunkCount int
	for fc := range fileChunkChan {
		if fc.Error != nil {
			t.Fatalf("Unexpected error: %v", fc.Error)
		}
		reconstructed = append(reconstructed, fc.Data...)
		chunkCount++
	}

	if !bytes.Equal(reconstructed, content) {
		t.Errorf("Binary data mismatch")
		t.Logf("  original length: %d", len(content))
		t.Logf("  reconstructed length: %d", len(reconstructed))

		// Find first difference
		for i := 0; i < len(content) && i < len(reconstructed); i++ {
			if content[i] != reconstructed[i] {
				t.Logf("  first diff at byte %d: expected %d, got %d", i, content[i], reconstructed[i])
				break
			}
		}
	}

	t.Logf("Read %d bytes in %d chunks", len(reconstructed), chunkCount)
}
