package main

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"time"

	"coreader-worker/utils"

	qdrant "github.com/qdrant/go-client/qdrant"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type QdrantClient struct {
	Client *qdrant.Client
}

const (
	// Collection names
	CollectionBookChunks = "book_chunks"
	CollectionEntities   = "entities"

	// Vector dimensions for nomic-embed-text model
	VectorDimension = 768
)

// InitQdrant initializes a Qdrant client with configuration from environment variables.
// Creates required collections if they don't exist.
func InitQdrant() (*QdrantClient, error) {
	host := utils.GetEnv("QDRANT_HOST", "localhost")
	portStr := utils.GetEnv("QDRANT_PORT", "6334")

	port, err := strconv.Atoi(portStr)
	if err != nil {
		return nil, fmt.Errorf("invalid QDRANT_PORT value '%s': %w", portStr, err)
	}

	addr := fmt.Sprintf("%s:%d", host, port)
	log.Printf("Initializing Qdrant client at %s", addr)

	client, err := qdrant.NewClient(&qdrant.Config{
		Host: host,
		Port: port,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Qdrant client: %w", err)
	}

	// Test connection with a simple health check
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	healthCheckResult, err := client.HealthCheck(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Qdrant at %s: %w", addr, err)
	}

	log.Printf("Connected to Qdrant successfully! Version: %s", healthCheckResult.GetVersion())

	qc := &QdrantClient{Client: client}

	// Create collections if they don't exist
	if err := qc.ensureCollections(ctx); err != nil {
		return nil, fmt.Errorf("failed to ensure collections: %w", err)
	}

	return qc, nil
}

// ensureCollections creates required collections if they don't exist
func (qc *QdrantClient) ensureCollections(ctx context.Context) error {
	// Create book_chunks collection
	if err := qc.createCollectionIfNotExists(ctx, CollectionBookChunks); err != nil {
		return fmt.Errorf("failed to create %s collection: %w", CollectionBookChunks, err)
	}

	// Create entities collection (placeholder for future use)
	if err := qc.createCollectionIfNotExists(ctx, CollectionEntities); err != nil {
		return fmt.Errorf("failed to create %s collection: %w", CollectionEntities, err)
	}

	return nil
}

// createCollectionIfNotExists creates a collection if it doesn't already exist
func (qc *QdrantClient) createCollectionIfNotExists(ctx context.Context, collectionName string) error {
	// Check if collection exists
	exists, err := qc.Client.CollectionExists(ctx, collectionName)
	if err != nil {
		return fmt.Errorf("failed to check if collection exists: %w", err)
	}

	if exists {
		log.Printf("Collection '%s' already exists", collectionName)
		return nil
	}

	// Create collection with appropriate configuration
	log.Printf("Creating collection '%s'...", collectionName)
	err = qc.Client.CreateCollection(ctx, &qdrant.CreateCollection{
		CollectionName: collectionName,
		VectorsConfig: qdrant.NewVectorsConfig(&qdrant.VectorParams{
			Size:     VectorDimension,
			Distance: qdrant.Distance_Cosine,
		}),
	})
	if err != nil {
		return fmt.Errorf("failed to create collection: %w", err)
	}

	log.Printf("Collection '%s' created successfully", collectionName)
	return nil
}

// StoreChunkEmbedding stores a chunk's embedding in Qdrant
func (qc *QdrantClient) StoreChunkEmbedding(ctx context.Context, bookID primitive.ObjectID, chunkID primitive.ObjectID, chunkIndex int, embedding []float32) error {
	// Convert ObjectID to a numeric ID for Qdrant
	// We use a hash of the hex string to get a uint64
	chunkIDStr := chunkID.Hex()
	var pointIDNum uint64
	for i, c := range []byte(chunkIDStr) {
		pointIDNum ^= uint64(c) << (uint(i%8) * 8)
	}

	// Create payload with metadata
	payload := map[string]interface{}{
		"bookId":     bookID.Hex(),
		"chunkId":    chunkID.Hex(),
		"chunkIndex": chunkIndex,
	}

	// Create point
	point := &qdrant.PointStruct{
		Id:      qdrant.NewIDNum(pointIDNum),
		Vectors: qdrant.NewVectors(embedding...),
		Payload: qdrant.NewValueMap(payload),
	}

	// Upsert point to collection
	_, err := qc.Client.Upsert(ctx, &qdrant.UpsertPoints{
		CollectionName: CollectionBookChunks,
		Points:         []*qdrant.PointStruct{point},
	})
	if err != nil {
		return fmt.Errorf("failed to upsert chunk embedding: %w", err)
	}

	return nil
}

// Close closes the Qdrant client connection
func (qc *QdrantClient) Close() error {
	if qc.Client != nil {
		return qc.Client.Close()
	}
	return nil
}
