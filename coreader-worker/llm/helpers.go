package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

// DescribeEntity analyzes entity context and returns a structured description.
// This is a helper function that works with any Client implementation.
func DescribeEntity(ctx context.Context, session Session, in EntityDescriptionInput) (*EntityDescription, error) {
	prompt := buildEntityDescriptionPrompt(in)

	options := Options{
		Temperature: 0.1,
		Format:      EntityDescriptionFormat(),
	}

	response, err := session.GenerateCompletion(ctx, prompt, options)
	if err != nil {
		return nil, err
	}

	// Parse the model's response as JSON into EntityDescription
	var desc EntityDescription
	if err := json.Unmarshal([]byte(response), &desc); err != nil {
		return nil, fmt.Errorf("parse llm JSON: %w\nraw=%s", err, response)
	}

	// If model didn't fill name, set it from input
	if desc.Name == "" {
		desc.Name = in.EntityName
	}

	return &desc, nil
}

// AnalyzeChunk sends a TextChunk to the LLM and returns structured metadata.
// This is a helper function that works with any Client implementation.
func AnalyzeChunk(ctx context.Context, session Session, bookTitle string, chunk string) (*ChunkLLMMetadata, error) {
	if strings.TrimSpace(chunk) == "" {
		// empty chunk → no entities
		return &ChunkLLMMetadata{
			Entities: []ChunkEntityRef{},
			Chapters: []string{},
		}, nil
	}

	prompt := buildChunkAnalysisPrompt(bookTitle, chunk)

	options := Options{
		Temperature: 0.1,
		Format:      ChunkMetadataFormat(),
	}

	response, err := session.GenerateCompletion(ctx, prompt, options)
	if err != nil {
		return nil, err
	}

	// Parse JSON from response into our metadata struct
	var meta ChunkLLMMetadata
	if err := json.Unmarshal([]byte(response), &meta); err != nil {
		return nil, fmt.Errorf("parse llm JSON: %w\nraw=%s", err, response)
	}

	// Normalize nil slice
	if meta.Entities == nil {
		meta.Entities = []ChunkEntityRef{}
	}
	if meta.Chapters == nil {
		meta.Chapters = []string{}
	}

	return &meta, nil
}

// AnalyzeBookHeader analyzes the beginning of a book and extracts header metadata.
// This is a helper function that works with any Client implementation.
func AnalyzeBookHeader(ctx context.Context, session Session, chunk string) (*BookHeaderMetadata, error) {
	if strings.TrimSpace(chunk) == "" {
		return &BookHeaderMetadata{
			HasHeader: false,
		}, nil
	}

	prompt := buildBookHeaderPrompt(chunk)

	options := Options{
		Temperature: 0.1,
		Format:      BookHeaderFormat(),
	}

	response, err := session.GenerateCompletion(ctx, prompt, options)
	if err != nil {
		return nil, err
	}

	var meta BookHeaderMetadata
	if err := json.Unmarshal([]byte(response), &meta); err != nil {
		return nil, fmt.Errorf("parse llm JSON: %w\nraw=%s", err, response)
	}

	return &meta, nil
}

// =======================
// Prompt builders
// =======================

func buildEntityDescriptionPrompt(in EntityDescriptionInput) string {
	entityLabel := in.EntityName
	if in.EntityType != "" {
		entityLabel = fmt.Sprintf("%s (%s)", in.EntityName, in.EntityType)
	}

	bookPart := ""
	if in.BookTitle != "" {
		bookPart = fmt.Sprintf(" from the book \"%s\"", in.BookTitle)
	}

	setup := "You are an assistant that summarizes entities in books."
	tasks := []string{
		"Read the context.",
		fmt.Sprintf("Describe the entity \"%s\"%s.", entityLabel, bookPart),
		"Use ONLY the information in the context.",
		"DO NOT invent details that are not supported by the context.",
	}
	schema := `STRICTLY a JSON object with this schema (no extra text):

{
  "name": string,
  "summary": string,
  "role": string,
  "traits": string[],
  "importantLocations": string[],
  "importantRelationships": string[]
}`
	rules := []string{
		"\"summary\" is a short neutral description (2-4 sentences max).",
		"\"role\" is a short phrase like \"main protagonist\", \"supporting character\", \"antagonist\", \"location\", etc.",
		"\"traits\" is a list of key attributes (e.g. [\"brave\",\"impulsive\"]).",
		"\"importantLocations\" is a list of place names strongly tied to this entity.",
		"\"importantRelationships\" is a list of important people or entities they are connected to.",
		"If some fields are unknown, use empty string or empty array.",
	}

	return buildPrompt(setup, tasks, PromptChunk{Label: "Context", Text: in.Context}, schema, rules)
}

func buildChunkAnalysisPrompt(bookTitle, text string) string {
	bookPart := ""
	if strings.TrimSpace(bookTitle) != "" {
		bookPart = fmt.Sprintf(" from the book \"%s\"", bookTitle)
	}

	setup := fmt.Sprintf("You are an assistant that analyzes a single chunk of text%s.", bookPart)
	tasks := []string{
		"Find all named entities of interest: CHARACTERS, PLACES, SPELLS, SONGS, ARTIFACTS, ORGANIZATIONS, WORKS (book titles), ANIMALS, PLANTS, EVENTS, and OTHER notable things.",
		"Work ONLY within this chunk. You do NOT have the rest of the book.",
		"Mark whether each entity appears to be introduced for the first time in THIS CHUNK (local, not global to the book).",
		"Detect every chapter heading present in the chunk (e.g. \"Chapter 3\", \"Capitolul 2\", \"Part II\", or similar). Include all chapter headings found, not just the first.",
	}
	schema := `STRICTLY a JSON object with this structure (no extra text):

{
  "entities": [
    {
      "name": string,
      "type": "character" | "place" | "spell" | "song" | "artifact" | "other",
      "startOffset": number,
      "endOffset": number,
      "isIntroducedInThisChunk": boolean
    }
  ],
  "chapters": string[]
}`
	rules := []string{
		"\"startOffset\" and \"endOffset\" are 0-based character indices into the given chunk text.",
		"\"endOffset\" is exclusive.",
		"If you are not sure about offsets, approximate as best as you can.",
		"If no entities are found, use an empty array for \"entities\".",
		"If there are no chapter headings, return an empty array for \"chapters\".",
	}

	return buildPrompt(setup, tasks, PromptChunk{Label: "Chunk", Text: text}, schema, rules)
}

func buildBookHeaderPrompt(chunkText string) string {
	setup := "You analyze the beginning of a book text. It may contain a header/antet with metadata and a table of contents."
	tasks := []string{
		"Detect if there is a book header (with title, author, edition, publisher, language etc.).",
	}
	schema := `ONLY valid JSON with this structure:

{
  "hasHeader": boolean,
  "title": string,
  "author": string,
  "subtitle": string,
  "edition": string,
  "publisher": string,
  "language": string
}`
	rules := []string{
		"If you are not sure about a field, use an empty string.",
	}

	return buildPrompt(setup, tasks, PromptChunk{Label: "Chunk", Text: chunkText}, schema, rules)
}

type PromptChunk struct {
	Label string
	Text  string
}

func buildPrompt(setup string, tasks []string, chunk PromptChunk, schema string, rules []string) string {
	return fmt.Sprintf(`
%s

Your task:
%s

%s:
---
%s
---

Return %s

Rules:
%s
`, strings.TrimSpace(setup), formatBulletList(tasks), chunk.Label, chunk.Text, strings.TrimSpace(schema), formatBulletList(rules))
}

func formatBulletList(items []string) string {
	if len(items) == 0 {
		return ""
	}

	var builder strings.Builder
	for i, item := range items {
		if i > 0 {
			builder.WriteString("\n")
		}
		builder.WriteString("- ")
		builder.WriteString(strings.TrimSpace(item))
	}
	return builder.String()
}
