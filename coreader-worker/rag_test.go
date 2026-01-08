package main

import (
	"coreader-worker/llm"
	"testing"
)

// TestPriorChunkContextStructure tests that the PriorChunkContext struct is correctly defined
func TestPriorChunkContextStructure(t *testing.T) {
	ctx := llm.PriorChunkContext{
		ChunkIndex: 5,
		Text:       "Sample text from prior chunk",
	}

	if ctx.ChunkIndex != 5 {
		t.Errorf("Expected ChunkIndex to be 5, got %d", ctx.ChunkIndex)
	}

	if ctx.Text != "Sample text from prior chunk" {
		t.Errorf("Expected Text to match, got %s", ctx.Text)
	}
}

// TestSimilarChunkResultStructure tests that the SimilarChunkResult struct is correctly defined
func TestSimilarChunkResultStructure(t *testing.T) {
	// This test just validates the structure compiles
	result := SimilarChunkResult{
		ChunkIndex: 3,
		Score:      0.85,
	}

	if result.ChunkIndex != 3 {
		t.Errorf("Expected ChunkIndex to be 3, got %d", result.ChunkIndex)
	}

	if result.Score != 0.85 {
		t.Errorf("Expected Score to be 0.85, got %f", result.Score)
	}
}
