package llm

import (
	"context"
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

// OllamaClient implements the Client interface for Ollama API.

type OllamaClient struct {
	loggingEnabled bool
	Provider       *api.Client
	Model          string
}

type OllamaSession struct {
	SessionID string
	Client    *OllamaClient
	logger    *Logger
}

// NewOllamaClient creates a new Ollama client from environment variables.
func NewOllamaClient() Client {
	baseURL := getEnvWithDefault("OLLAMA_BASE_URL", "http://llm:11434")
	model := getEnvWithDefault("OLLAMA_MODEL", defaultOllamaModel)
	loggingEnabled := getEnvWithDefault("LLM_LOGGING_ENABLED", "true") == "true"

	// Parse base URL
	parsedURL, err := url.Parse(baseURL)
	if err != nil {
		panic(fmt.Sprintf("invalid OLLAMA_BASE_URL: %v", err))
	}

	// Create Ollama client
	client := api.NewClient(parsedURL, &http.Client{
		Timeout: 3 * time.Minute,
	})

	log.Printf("Using Ollama LLM client with base URL: %s and model: %s", baseURL, model)

	return &OllamaClient{
		Provider:       client,
		loggingEnabled: loggingEnabled,
		Model:          model,
	}
}

func (c *OllamaClient) NewSession(sessionId string) Session {
	return &OllamaSession{
		SessionID: sessionId,
		Client:    c,
		logger:    NewLogger(true, "./llm_logs", sessionId),
	}
}

// GenerateCompletion sends a prompt to Ollama and returns the raw response.
// This is the single function that handles all model requests.
func (s *OllamaSession) GenerateCompletion(ctx context.Context, prompt string, options Options) (string, error) {
	response, err := s.doRequest(ctx, prompt, options)
	s.logger.LogRequest(prompt, &options, response, err)
	return response, err
}

func (s *OllamaSession) doRequest(ctx context.Context, prompt string, options Options) (string, error) {
	req := &api.GenerateRequest{
		Model:  s.Client.Model,
		Prompt: prompt,
		Stream: new(bool), // false
		Options: map[string]any{
			"temperature": options.Temperature,
		},
	}

	// Set format if specified (e.g., "json")
	if options.Format != nil {
		req.Format = json.RawMessage(`"json"`)
	}

	var responseText strings.Builder
	err := s.Client.Provider.Generate(ctx, req, func(resp api.GenerateResponse) error {
		responseText.WriteString(resp.Response)
		return nil
	})

	if err != nil {
		return "", fmt.Errorf("ollama generate error: %w", err)
	}

	return responseText.String(), nil
}
