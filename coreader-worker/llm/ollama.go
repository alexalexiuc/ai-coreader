package llm

import (
	"context"
	utils "coreader-worker/utils"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/ollama/ollama/api"
)

const defaultOllamaModel = "phi3:mini"
const defaultEmbeddingModel = "nomic-embed-text"

// OllamaClient implements the Client interface for Ollama API.

type OllamaClient struct {
	Provider       *api.Client
	Model          string
	EmbeddingModel string
}

// NewOllamaClient creates a new Ollama client from environment variables.
func NewOllamaClient() LLMClient {
	baseURL := utils.GetEnv("LLM_BASE_URL", "http://localhost:11434")
	model := utils.GetEnv("OLLAMA_MODEL", defaultOllamaModel)
	embeddingModel := utils.GetEnv("OLLAMA_EMBEDDING_MODEL", defaultEmbeddingModel)

	// Parse base URL
	parsedURL, err := url.Parse(baseURL)
	if err != nil {
		panic(fmt.Sprintf("invalid LLM_BASE_URL: %v", err))
	}

	// Create Ollama client
	client := api.NewClient(parsedURL, &http.Client{
		Timeout: 3 * time.Minute,
	})

	log.Printf("Using Ollama LLM client with base URL: %s and model: %s (embedding: %s)", baseURL, model, embeddingModel)

	return &OllamaClient{
		Provider:       client,
		Model:          model,
		EmbeddingModel: embeddingModel,
	}
}

// GenerateCompletion sends a prompt to Ollama and returns the raw response.
// This is the single function that handles all model requests.
func (c *OllamaClient) GenerateCompletion(ctx context.Context, prompt string, options Options) (string, error) {
	return c.doRequest(ctx, prompt, options)
}

func (c *OllamaClient) doRequest(ctx context.Context, prompt string, options Options) (string, error) {
	req := &api.GenerateRequest{
		Model:  c.Model,
		Prompt: prompt,
		Stream: new(bool), // false
		Options: map[string]any{
			"temperature": options.Temperature,
		},
	}

	if options.Format != nil {
		req.Format = json.RawMessage(`"json"`)
	}

	var responseText strings.Builder
	err := c.Provider.Generate(ctx, req, func(resp api.GenerateResponse) error {
		responseText.WriteString(resp.Response)
		return nil
	})

	if err != nil {
		return "", fmt.Errorf("ollama generate error: %w", err)
	}

	return responseText.String(), nil
}

// Ping sends a minimal request to warm the model into memory.
func (c *OllamaClient) Ping(ctx context.Context) error {
	_, err := c.doRequest(ctx, "hi", Options{Temperature: 0})
	return err
}

// GenerateEmbedding generates a vector embedding for the given text using Ollama's embedding model.
func (c *OllamaClient) GenerateEmbedding(ctx context.Context, text string) ([]float32, error) {
	req := &api.EmbedRequest{
		Model: c.EmbeddingModel,
		Input: text,
	}

	resp, err := c.Provider.Embed(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("ollama embed error: %w", err)
	}

	if len(resp.Embeddings) == 0 {
		return nil, fmt.Errorf("no embeddings returned from Ollama")
	}

	// Convert []float64 to []float32 for Qdrant compatibility
	embedding := make([]float32, len(resp.Embeddings[0]))
	for i, v := range resp.Embeddings[0] {
		embedding[i] = float32(v)
	}

	return embedding, nil
}
