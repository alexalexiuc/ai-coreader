package utils

import (
	"crypto/sha256"
	"fmt"
	"os"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// GenerateEntityID creates a deterministic ObjectID from bookId, name, and type.
// This allows EntityMentions and ChunkEntityRef to reference entities before
// EntityDescriptions are created in PostProcess.
func GenerateEntityID(bookID primitive.ObjectID, name, entityType string) primitive.ObjectID {
	// Create deterministic hash from bookId + name + type
	input := fmt.Sprintf("%s:%s:%s", bookID.Hex(), name, entityType)
	hash := sha256.Sum256([]byte(input))

	// Use first 12 bytes of hash as ObjectID
	var objectIDBytes [12]byte
	copy(objectIDBytes[:], hash[:12])

	return primitive.ObjectID(objectIDBytes)
}

func GetEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func GetEnvWithPanic(key string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	panic(key + " is not set")
}
