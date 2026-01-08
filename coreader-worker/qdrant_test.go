package main

import (
	"context"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// TestQdrantCollectionCreation tests that collections are created correctly
func TestQdrantCollectionCreation(t *testing.T) {
	// Skip if QDRANT_HOST is not set (integration test)
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Initialize Qdrant client
	qc, err := InitQdrant()
	if err != nil {
		t.Skipf("Could not connect to Qdrant (expected in CI): %v", err)
		return
	}
	defer qc.Close()

	// Check that book_chunks collection exists
	exists, err := qc.Client.CollectionExists(ctx, CollectionBookChunks)
	if err != nil {
		t.Fatalf("Failed to check if book_chunks collection exists: %v", err)
	}
	if !exists {
		t.Errorf("Expected book_chunks collection to exist, but it doesn't")
	}

	// Check that entities collection exists
	exists, err = qc.Client.CollectionExists(ctx, CollectionEntities)
	if err != nil {
		t.Fatalf("Failed to check if entities collection exists: %v", err)
	}
	if !exists {
		t.Errorf("Expected entities collection to exist, but it doesn't")
	}
}

// TestStoreChunkEmbedding tests storing a chunk embedding in Qdrant
func TestStoreChunkEmbedding(t *testing.T) {
	// Skip if QDRANT_HOST is not set (integration test)
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Initialize Qdrant client
	qc, err := InitQdrant()
	if err != nil {
		t.Skipf("Could not connect to Qdrant (expected in CI): %v", err)
		return
	}
	defer qc.Close()

	// Create test data
	bookID := primitive.NewObjectID()
	chunkID := primitive.NewObjectID()
	chunkIndex := 0
	embedding := make([]float32, qc.VectorDimension)
	for i := range embedding {
		embedding[i] = float32(i) / float32(qc.VectorDimension)
	}

	// Store embedding
	err = qc.StoreChunkEmbedding(ctx, bookID, chunkID, chunkIndex, embedding)
	if err != nil {
		t.Fatalf("Failed to store chunk embedding: %v", err)
	}

	t.Logf("Successfully stored embedding for chunk %s", chunkID.Hex())
}
