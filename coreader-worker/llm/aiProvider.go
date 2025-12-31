package llm

import (
	"context"
	utils "coreader-worker/utils"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/cecil-the-coder/ai-provider-kit/pkg/factory"
	"github.com/cecil-the-coder/ai-provider-kit/pkg/types"
)

var SupportedClients = map[string]bool{"ollama": true, "openai": true}

type AIClient struct {
	loggingEnabled bool
	Provider       types.Provider
}

type AISession struct {
	SessionID string
	Client    *AIClient
	logger    *Logger
}

func NewClientFromEnv() (Client, error) {
	clientType := strings.ToLower(strings.TrimSpace(utils.GetEnv("AI_CLIENT", "ollama")))
	loggingEnabled := utils.GetEnv("LLM_LOGGING_ENABLED", "true") == "true"

	if ok, supported := SupportedClients[clientType]; !supported || !ok {
		return nil, fmt.Errorf("unsupported AI_CLIENT: %s", clientType)
	}

	log.Printf("Using LLM client: %s (logging: %v)", clientType, loggingEnabled)

	var provider types.Provider
	var err error

	switch clientType {
	case "ollama":
		// There are issues when using the provider factory here, so directly create the Ollama client.
		// config := types.ProviderConfig{
		// 	Type:         "ollama",
		// 	Name:         "ollama-primary",
		// 	BaseURL:      getEnvWithDefault("LLM_BASE_URL", "http://localhost:11434"),
		// 	DefaultModel: getEnvWithDefault("OLLAMA_MODEL", "phi4-mini"),
		// 	Timeout:      10 * time.Minute,
		// 	ProviderConfig: map[string]any{
		// 		"timeout": 10 * time.Minute, // 10 minute timeout
		// 	},
		// }
		// provider, err = newProvider(config)
		return NewOllamaClient(), nil
	case "openai":
		apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
		if apiKey == "" {
			return nil, fmt.Errorf("OPENAI_API_KEY is required when AI_CLIENT=openai")
		}
		config := types.ProviderConfig{
			Type:         "openai",
			Name:         "openai-primary",
			APIKey:       apiKey,
			DefaultModel: utils.GetEnv("OPENAI_MODEL", "gpt-4.1-mini"),
			Timeout:      10 * time.Minute,
		}
		provider, err = newProvider(config)
	default:
		return nil, fmt.Errorf("unsupported AI_CLIENT: %s", clientType)
	}

	if err != nil {
		return nil, err
	}

	return &AIClient{
		loggingEnabled: loggingEnabled,
		Provider:       provider,
	}, nil
}

func newProvider(config types.ProviderConfig) (types.Provider, error) {
	f := factory.NewProviderFactory()
	factory.RegisterDefaultProviders(f)

	provider, err := f.CreateProvider(config.Type, config)
	if err != nil {
		return nil, fmt.Errorf("create provider %q: %w", config.Type, err)
	}
	return provider, nil
}

func (c *AIClient) NewSession(sessionId string) Session {
	return &AISession{
		SessionID: sessionId,
		Client:    c,
		logger:    NewLogger(true, "./llm_logs", sessionId),
	}
}

func (s *AISession) GenerateCompletion(ctx context.Context, prompt string, options Options) (string, error) {
	response, err := s.doRequest(ctx, prompt, options)
	if s.Client.loggingEnabled && s.logger != nil {
		_ = s.logger.LogRequest(prompt, &options, response, err)
	}
	return response, err
}

func (s *AISession) doRequest(ctx context.Context, prompt string, options Options) (string, error) {
	req := types.GenerateOptions{
		Messages: []types.ChatMessage{
			{Role: "user", Content: prompt},
		},
		Temperature: options.Temperature,
		Timeout:     10 * time.Minute,
		Stream:      false,
	}

	// If options.Format is a schema object, pass it as JSON string to provider kit.
	if options.Format != nil {
		schemaJSON, err := json.Marshal(options.Format)
		if err != nil {
			return "", fmt.Errorf("failed to marshal JSON schema format: %w", err)
		}
		req.ResponseFormat = string(schemaJSON)
	}

	stream, err := s.Client.Provider.GenerateChatCompletion(ctx, req)
	if err != nil {
		return "", err
	}
	defer stream.Close()

	var final types.ChatCompletionChunk
	for {
		chunk, err := stream.Next()
		if err != nil {
			return "", fmt.Errorf("error getting next chunk: %w", err)
		}
		if chunk.Done {
			final = chunk
			break
		}
	}

	if final.Error != "" {
		return "", fmt.Errorf("LLM error: %s", final.Error)
	}
	if len(final.Choices) == 0 || final.Choices[0].Message.Content == "" {
		return "", fmt.Errorf("empty LLM response")
	}

	return final.Choices[0].Message.Content, nil
}
