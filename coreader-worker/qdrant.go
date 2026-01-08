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
	Client          *qdrant.Client
	VectorDimension uint64
}

const (
	// Collection names
	CollectionBookChunks = "book_chunks"
	CollectionEntities   = "entities"
)

// InitQdrant initializes a Qdrant client with configuration from environment variables.
// Creates required collections if they don't exist.
func InitQdrant() (*QdrantClient, error) {
	host := utils.GetEnv("QDRANT_HOST", "localhost")
	portStr := utils.GetEnv("QDRANT_PORT", "6334")
	vectorDimStr := utils.GetEnv("QDRANT_VECTOR_DIMENSION", "768")

	port, err := strconv.Atoi(portStr)
	if err != nil {
		return nil, fmt.Errorf("invalid QDRANT_PORT value '%s': %w", portStr, err)
	}

	vectorDim, err := strconv.ParseUint(vectorDimStr, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid QDRANT_VECTOR_DIMENSION value '%s': %w", vectorDimStr, err)
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

	qc := &QdrantClient{Client: client, VectorDimension: vectorDim}

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
			Size:     qc.VectorDimension,
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
	payload := map[string]any{
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

// SimilarChunkResult represents a similar chunk returned from vector search
type SimilarChunkResult struct {
	ChunkID    primitive.ObjectID
	ChunkIndex int
	Score      float32 // Similarity score (higher is more similar)
}

// SearchSimilarChunks finds the most similar chunks to the given embedding within the same book.
// It excludes the current chunk index from results.
// Returns up to 'limit' results ordered by similarity (most similar first).
func (qc *QdrantClient) SearchSimilarChunks(ctx context.Context, bookID primitive.ObjectID, currentChunkIndex int, embedding []float32, limit uint64) ([]SimilarChunkResult, error) {
	// Build filter to restrict search to the same book and exclude current chunk
	filter := &qdrant.Filter{
		Must: []*qdrant.Condition{
			// Match the same book
			qdrant.NewMatch("bookId", bookID.Hex()),
		},
		MustNot: []*qdrant.Condition{
			// Exclude the current chunk (use NewMatchInt for integer matching)
			qdrant.NewMatchInt("chunkIndex", int64(currentChunkIndex)),
		},
	}

	// Perform the search
	searchResult, err := qc.Client.Query(ctx, &qdrant.QueryPoints{
		CollectionName: CollectionBookChunks,
		Query:          qdrant.NewQuery(embedding...),
		Filter:         filter,
		Limit:          &limit,
		WithPayload:    qdrant.NewWithPayload(true),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to search similar chunks: %w", err)
	}

	// Convert results to our struct
	results := make([]SimilarChunkResult, 0, len(searchResult))
	for _, point := range searchResult {
		payload := point.GetPayload()

		// Extract chunkId from payload
		chunkIDValue, ok := payload["chunkId"]
		if !ok {
			log.Printf("Warning: point missing chunkId in payload")
			continue
		}
		chunkIDStr := chunkIDValue.GetStringValue()
		if chunkIDStr == "" {
			log.Printf("Warning: chunkId is not a string or is empty")
			continue
		}
		chunkID, err := primitive.ObjectIDFromHex(chunkIDStr)
		if err != nil {
			log.Printf("Warning: invalid chunkId hex string: %v", err)
			continue
		}

		// Extract chunkIndex from payload
		chunkIndexValue, ok := payload["chunkIndex"]
		if !ok {
			log.Printf("Warning: point missing chunkIndex in payload")
			continue
		}
		chunkIndex := chunkIndexValue.GetIntegerValue()

		results = append(results, SimilarChunkResult{
			ChunkID:    chunkID,
			ChunkIndex: int(chunkIndex),
			Score:      point.GetScore(),
		})
	}

	return results, nil
}

// Close closes the Qdrant client connection
func (qc *QdrantClient) Close() error {
	if qc.Client != nil {
		return qc.Client.Close()
	}
	return nil
}
