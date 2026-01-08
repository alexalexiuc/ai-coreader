package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"coreader-worker/utils"

	qdrant "github.com/qdrant/go-client/qdrant"
)

type QdrantClient struct {
	Client *qdrant.Client
}

// InitQdrant initializes a Qdrant client with configuration from environment variables.
// This is infrastructure-only setup; no collection creation or vector operations are performed.
func InitQdrant() (*QdrantClient, error) {
	host := utils.GetEnv("QDRANT_HOST", "localhost")
	port := utils.GetEnv("QDRANT_PORT", "6334")

	addr := fmt.Sprintf("%s:%s", host, port)
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

	return &QdrantClient{Client: client}, nil
}

// Close closes the Qdrant client connection
func (qc *QdrantClient) Close() error {
	if qc.Client != nil {
		return qc.Client.Close()
	}
	return nil
}
