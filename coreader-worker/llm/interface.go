package llm

import (
	"context"
)

// EntityDescriptionInput describes what we send into the LLM to describe an entity.
type EntityDescriptionInput struct {
	EntityName string
	EntityType string // optional, e.g. "character", "place"
	BookTitle  string // optional, just for nicer prompts
	Context    string // text from chunks (already concatenated)
}

// EntityDescription is what we expect back from the LLM as JSON.
type EntityDescription struct {
	Name                   string   `json:"name"`
	Summary                string   `json:"summary"`
	Role                   string   `json:"role,omitempty"`
	Traits                 []string `json:"traits,omitempty"`
	ImportantLocations     []string `json:"importantLocations,omitempty"`
	ImportantRelationships []string `json:"importantRelationships,omitempty"`
}

// BookHeaderMetadata represents metadata extracted from the book header.
type BookHeaderMetadata struct {
	HasHeader bool   `json:"hasHeader"`
	Title     string `json:"title"`
	Author    string `json:"author"`
	Subtitle  string `json:"subtitle"`
	Edition   string `json:"edition"`
	Publisher string `json:"publisher"`
	// Series            string   `json:"series"`
	Language string `json:"language"`
	// TableOfContents   []string `json:"tableOfContents"`   // raw chapter lines if found
	// HeaderStartOffset int      `json:"headerStartOffset"` // char index where main story starts in this chunk
}

// ChunkEntityRef represents an entity reference found in a chunk.
type ChunkEntityRef struct {
	EntityID string `json:"entityId,omitempty"`
	Name     string `json:"name"`
	Type     string `json:"type"` // character, place, spell, song, artifact, other
	// Subtype      string `json:"subtype"`
	StartOffsets []int `json:"startOffsets"`
}

// ChunkLLMMetadata represents metadata extracted from analyzing a chunk.
type ChunkLLMMetadata struct {
	Entities []ChunkEntityRef `json:"entities,omitempty"`
	Chapters []string         `json:"chapters,omitempty"`
}

// LLMClient is the interface for interacting with language models.
// Different implementations can be swapped (local, remote, different providers).
type LLMClient interface {
	// GenerateCompletion sends a prompt to the model and returns the raw response.
	// Callers may attach logging context via llm.WithLogger.
	GenerateCompletion(ctx context.Context, prompt string, options Options) (string, error)

	// GenerateEmbedding generates a vector embedding for the given text.
	GenerateEmbedding(ctx context.Context, text string) ([]float32, error)
}

// Options represents configuration options for model generation.
type Options struct {
	Temperature float64
	Format      *JSONSchemaFormat // nil means no response format enforcement
	// TopP        float32
	// TopK        int
	// NumCtx      int
	// Seed        int
}

// NewClientFromEnv selects the LLM client based on AI_CLIENT env var and enables logging.
// Supported values: "ollama" (default), "openai".
// func NewClientFromEnv(enableLogging bool) (Client, error) {
// 	clientType := strings.ToLower(strings.TrimSpace(os.Getenv("AI_CLIENT")))
// 	if clientType == "" {
// 		clientType = "ollama" // default
// 	}

// 	log.Printf("Using LLM client: %s (logging: %v)", clientType, enableLogging)

// 	switch clientType {
// 	case "ollama":
// 		return NewClient(enableLogging), nil
// 	case "openai":
// 		return NewOpenAIClient(enableLogging)
// 	default:
// 		return nil, fmt.Errorf("unsupported AI_CLIENT: %q (use 'ollama' or 'openai')", clientType)
// 	}
// }
