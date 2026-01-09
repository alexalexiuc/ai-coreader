package llm

import (
	"context"
	"encoding/json"
	"fmt"
)

type EntityFactsInput struct {
	EntityName string
	EntityType string
	Snippet    string
}

type EntityFact struct {
	FactType   string  `json:"factType"`
	Value      any     `json:"value"`
	Confidence float64 `json:"confidence"`
	Evidence   string  `json:"evidence"`
}

type entityFactsResponse struct {
	Facts []EntityFact `json:"facts"`
}

// ExtractEntityFactsFromSnippet extracts small, grounded facts for a single mention snippet.
func ExtractEntityFactsFromSnippet(ctx context.Context, client LLMClient, in EntityFactsInput) ([]EntityFact, error) {
	prompt := buildEntityFactsPrompt(in)
	options := Options{
		Temperature: 0.1,
		Format:      EntityFactsFormat(),
	}

	response, err := client.GenerateCompletion(ctx, prompt, options)
	logRequest(ctx, "ExtractEntityFactsFromSnippet", prompt, &options, response, err)
	if err != nil {
		return nil, err
	}

	var parsed entityFactsResponse
	if err := json.Unmarshal([]byte(response), &parsed); err != nil {
		return nil, fmt.Errorf("parse llm JSON: %w\nraw=%s", err, response)
	}
	return parsed.Facts, nil
}

type EntityDistillationInput struct {
	EntityName         string
	EntityType         string
	CurrentDescription string
	Facts              []EntityFact
	Snippets           []string
}

type DistilledEntityDescription struct {
	Description   string   `json:"description"`
	KeyFacts      []string `json:"keyFacts"`
	Uncertainties []string `json:"uncertainties"`
}

// DistillEntityDescription distills a bounded set of facts/snippets into a grounded entity description.
func DistillEntityDescription(ctx context.Context, client LLMClient, in EntityDistillationInput) (*DistilledEntityDescription, error) {
	prompt := buildEntityDistillationPrompt(in)
	options := Options{
		Temperature: 0.1,
		Format:      EntityDistillationFormat(),
	}

	response, err := client.GenerateCompletion(ctx, prompt, options)
	logRequest(ctx, "DistillEntityDescription", prompt, &options, response, err)
	if err != nil {
		return nil, err
	}

	var parsed DistilledEntityDescription
	if err := json.Unmarshal([]byte(response), &parsed); err != nil {
		return nil, fmt.Errorf("parse llm JSON: %w\nraw=%s", err, response)
	}
	return &parsed, nil
}
