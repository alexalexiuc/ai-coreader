package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

// ExtractEntityFacts extracts structured facts from a snippet mentioning an entity
func ExtractEntityFacts(ctx context.Context, client LLMClient, entityName, entityType, snippet string) ([]EntityFact, error) {
	prompt := buildFactExtractionPrompt(entityName, entityType, snippet)

	options := Options{
		Temperature: 0.1,
		Format:      EntityFactExtractionFormat(),
	}

	response, err := client.GenerateCompletion(ctx, prompt, options)
	logRequest(ctx, "ExtractEntityFacts", prompt, &options, response, err)
	if err != nil {
		return nil, err
	}

	var result EntityFactExtractionResult
	if err := json.Unmarshal([]byte(response), &result); err != nil {
		return nil, fmt.Errorf("parse llm JSON: %w\nraw=%s", err, response)
	}

	return result.Facts, nil
}

// DistillEntityDescription distills a consolidated description from facts and snippets
func DistillEntityDescription(ctx context.Context, client LLMClient, input EntityDistillationInput) (*EntityDistillationResult, error) {
	prompt := buildDistillationPrompt(input)

	options := Options{
		Temperature: 0.2,
		Format:      EntityDistillationFormat(),
	}

	response, err := client.GenerateCompletion(ctx, prompt, options)
	logRequest(ctx, "DistillEntityDescription", prompt, &options, response, err)
	if err != nil {
		return nil, err
	}

	var result EntityDistillationResult
	if err := json.Unmarshal([]byte(response), &result); err != nil {
		return nil, fmt.Errorf("parse llm JSON: %w\nraw=%s", err, response)
	}

	return &result, nil
}

func buildFactExtractionPrompt(entityName, entityType, snippet string) string {
	entityLabel := entityName
	if entityType != "" {
		entityLabel = fmt.Sprintf("%s (%s)", entityName, entityType)
	}

	setup := "You extract structured facts about an entity from a text snippet."
	tasks := []string{
		fmt.Sprintf("Entity: %s", entityLabel),
		"Read the snippet and extract ONLY facts that are explicitly stated or strongly implied.",
		"Each fact must have supporting evidence (a short quote from the snippet).",
		"If the snippet contains no useful information, return an empty facts array.",
		"IMPORTANT:",
		"- factType describes the TYPE OF STATEMENT about the entity, not the entity's category.",
		"- NEVER use the entity type (e.g. \"artifact\", \"character\") as a factType.",
		"- Even for artifacts, use factType such as \"appearance\", \"event\", or \"other\".",
	}

	schema := `STRICTLY a JSON object with this schema (no extra text):

{
  "facts": [
    {
      "factType": "role" | "trait" | "appearance" | "relationship" | "event" | "location" | "other",
      "value": string,
      "confidence": number (0-1),
      "evidence": string (max 20 words from snippet)
    }
  ]
}`

	rules := []string{
		"factType describes the KIND OF STATEMENT being made about the entity (e.g. appearance, event, role), NOT the entity's type. Never repeat the entity type as a factType.",
		"value should be atomic - one fact per item.",
		"confidence: 1.0 for explicit facts, 0.7-0.9 for strong implications, lower for weak ones.",
		"evidence must be a direct quote (or close paraphrase) from the snippet, max 20 words.",
		"Do not invent facts not supported by the snippet.",
		"NEVER make absence claims (e.g. \"has no X\", \"lacks Y\", \"not mentioned as Z\") unless the text EXPLICITLY states the absence.",
		"Only extract positive facts that are actually present or clearly implied in the snippet.",
		"If nothing useful is in the snippet, return empty facts array: {\"facts\": []}",
	}

	return buildPrompt(setup, tasks, PromptChunk{Label: "Snippet", Text: snippet}, schema, rules)
}

func buildDistillationPrompt(input EntityDistillationInput) string {
	entityLabel := input.EntityName
	if input.EntityType != "" {
		entityLabel = fmt.Sprintf("%s (%s)", input.EntityName, input.EntityType)
	}

	setup := fmt.Sprintf("You create a consolidated description of the entity \"%s\" based on extracted facts and evidence snippets.", entityLabel)

	currentDesc := ""
	if input.CurrentDescription != "" {
		currentDesc = fmt.Sprintf("\n\nCurrent description (may be empty or outdated):\n%s", input.CurrentDescription)
	}

	factsText := formatFacts(input.Facts)
	snippetsText := formatSnippets(input.Snippets)

	tasks := []string{
		"Synthesize the facts and snippets into a coherent description.",
		"The description should be 2-6 sentences, neutral, and grounded in the evidence.",
		"Extract 5-12 key facts as bullet points.",
		"Note any uncertainties or contradictions.",
	}

	schema := `STRICTLY a JSON object with this schema (no extra text):

{
  "description": string (2-6 sentences),
  "keyFacts": string[] (5-12 items),
  "uncertainties": string[] (things unclear or contradictory)
}`

	rules := []string{
		"description must not contradict the facts.",
		"If facts are weak or limited, keep description minimal and factual.",
		"keyFacts should be concise bullet-like statements.",
		"uncertainties should list gaps, contradictions, or unclear aspects.",
		"Do not invent information not present in facts/snippets.",
	}

	contextText := fmt.Sprintf(`%s

Facts:
%s

Evidence snippets:
%s`, currentDesc, factsText, snippetsText)

	return buildPrompt(setup, tasks, PromptChunk{Label: "Input", Text: contextText}, schema, rules)
}

func formatFacts(facts []EntityFact) string {
	if len(facts) == 0 {
		return "(No facts available)"
	}

	var lines []string
	for i, fact := range facts {
		valueStr := fmt.Sprintf("%v", fact.Value)
		line := fmt.Sprintf("%d. [%s] %s (confidence: %.2f)", i+1, fact.FactType, valueStr, fact.Confidence)
		if fact.Evidence != "" {
			line += fmt.Sprintf("\n   Evidence: \"%s\"", fact.Evidence)
		}
		lines = append(lines, line)
	}
	return strings.Join(lines, "\n")
}

func formatSnippets(snippets []string) string {
	if len(snippets) == 0 {
		return "(No snippets available)"
	}

	var lines []string
	for i, snippet := range snippets {
		lines = append(lines, fmt.Sprintf("%d. \"%s\"", i+1, snippet))
	}
	return strings.Join(lines, "\n")
}
