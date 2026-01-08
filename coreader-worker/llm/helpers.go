package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"strings"
)

// DescribeEntity analyzes entity context and returns a structured description.
// This is a helper function that works with any Client implementation.
func DescribeEntity(ctx context.Context, client LLMClient, in EntityDescriptionInput) (*EntityDescription, error) {
	prompt := buildEntityDescriptionPrompt(in)

	options := Options{
		Temperature: 0.1,
		Format:      EntityDescriptionFormat(),
	}

	response, err := client.GenerateCompletion(ctx, prompt, options)
	logRequest(ctx, "DescribeEntity", prompt, &options, response, err)
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

// PriorChunkContext represents context from a previous chunk
type PriorChunkContext struct {
	ChunkIndex int
	Text       string
}

// AnalyzeChunk sends a TextChunk to the LLM and returns structured metadata.
// This is a helper function that works with any Client implementation.
// priorContext contains excerpts from semantically similar chunks in the same book (can be empty).
func AnalyzeChunk(ctx context.Context, client LLMClient, bookTitle string, chunk string, priorContext []PriorChunkContext) (*ChunkLLMMetadata, error) {
	if strings.TrimSpace(chunk) == "" {
		// empty chunk → no entities
		return &ChunkLLMMetadata{
			Entities: []ChunkEntityRef{},
			Chapters: []string{},
		}, nil
	}

	prompt := buildChunkAnalysisPrompt(bookTitle, chunk, priorContext)

	options := Options{
		Temperature: 0.1,
		Format:      ChunkMetadataFormat(),
	}

	response, err := client.GenerateCompletion(ctx, prompt, options)
	logRequest(ctx, "AnalyzeChunk", prompt, &options, response, err)
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

	correctEntityOffsets(chunk, meta.Entities)

	return &meta, nil
}

// AnalyzeBookHeader analyzes the beginning of a book and extracts header metadata.
// This is a helper function that works with any Client implementation.
func AnalyzeBookHeader(ctx context.Context, client LLMClient, chunk string) (*BookHeaderMetadata, error) {
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

	response, err := client.GenerateCompletion(ctx, prompt, options)
	logRequest(ctx, "AnalyzeBookHeader", prompt, &options, response, err)
	if err != nil {
		return nil, err
	}

	var meta BookHeaderMetadata
	if err := json.Unmarshal([]byte(response), &meta); err != nil {
		return nil, fmt.Errorf("parse llm JSON: %w\nraw=%s", err, response)
	}

	return &meta, nil
}

// GenerateEmbedding wraps embedding generation to keep LLM calls consistent.
func GenerateEmbedding(ctx context.Context, client LLMClient, text string) ([]float32, error) {
	response, err := client.GenerateEmbedding(ctx, text)
	logRequest(ctx, "GenerateEmbedding", text, nil, fmt.Sprintf("embedding(len=%d)", len(response)), err)
	return response, err
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

	setup := "You are an assistant that summarizes entities in books. Entities can be characters, places, songs, artifacts, organizations, events, works, or other notable concepts."
	tasks := []string{
		"Read the provided context carefully.",
		fmt.Sprintf("Describe the entity \"%s\"%s.", entityLabel, bookPart),
		"Focus on what this entity is, why it matters, and how it is portrayed in the context.",
		"Use ONLY the information in the context; do not add outside knowledge or guesses.",
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
		"\"summary\" is a concise, neutral description (2-4 sentences max) grounded in the context.",
		"\"role\" is a short phrase capturing why the entity matters (e.g. \"main protagonist\", \"capital city\", \"anthem song\", \"legendary artifact\", \"secretive organization\").",
		"\"traits\" lists key attributes or properties (for non-people, note defining qualities like \"ancient\", \"enchanted\", \"fortified\").",
		"\"importantLocations\" lists places strongly tied to the entity (for locations, list notable sub-areas; for songs/artifacts/organizations, list places where they appear or are stored).",
		"\"importantRelationships\" lists other entities meaningfully connected to this one (people, places, groups, or artifacts).",
		"If some fields are unknown, use empty string or empty array.",
	}

	return buildPrompt(setup, tasks, PromptChunk{Label: "Context", Text: in.Context}, schema, rules)
}

func buildChunkAnalysisPrompt(bookTitle, text string, priorContext []PriorChunkContext) string {
	bookPart := ""
	if strings.TrimSpace(bookTitle) != "" {
		bookPart = fmt.Sprintf(" from the book \"%s\"", bookTitle)
	}

	setup := fmt.Sprintf("You are an assistant that analyzes a single chunk of text%s.", bookPart)
	tasks := []string{
		"Find all named entities of interest: CHARACTERS, PLACES, SPELLS, SONGS, ARTIFACTS, ORGANIZATIONS, WORKS (book titles), ANIMALS, PLANTS, EVENTS and any additional notable entities not covered above.",
		"Work ONLY within this chunk. You do NOT have the rest of the book.",
		"Detect every chapter heading present in the chunk (e.g. \"Chapter 3\", \"Capitolul 2\", \"Part II\", or similar). Include all chapter headings found, not just the first.",
	}

	// Add prior context instructions if available
	if len(priorContext) > 0 {
		tasks = append(tasks, "Earlier context from the same book is provided below to help with entity recognition and continuity. Use it to identify entities that may be referenced by pronouns or partial names in the current chunk.")
	}

	schema := `STRICTLY a JSON object with this structure (no extra text):

{
	"entities": [
    {
      "name": string,
      "type": "character" | "place" | "spell" | "song" | "artifact" | "other" | "organization" | "work" | "animal" | "plant" | "event",
      "startOffsets": number[]
    }
  ],
  "chapters": string[]
}`
	rules := []string{
		"type MUST be exactly one of the allowed strings above. If unsure, set type = \"other\"",
		"\"startOffsets\" is a list of 0-based character indices into the given chunk text for EACH encounter of the entity name.",
		"Always include all occurrences of the entity name you can find in this chunk.",
		"If no entities are found, use an empty array for \"entities\".",
		"If there are no chapter headings, return an empty array for \"chapters\".",
	}

	// Add rules for using prior context
	if len(priorContext) > 0 {
		rules = append(rules, "When earlier context mentions an entity, reuse the same entity name if it appears in the current chunk (even if referenced indirectly).")
		rules = append(rules, "The earlier context is for reference only - extract entities ONLY from the current chunk text, not from the earlier context.")
	}

	// Build the prompt with prior context if available
	if len(priorContext) > 0 {
		// Format prior context
		var priorContextText strings.Builder
		for i, pc := range priorContext {
			if i > 0 {
				priorContextText.WriteString("\n\n")
			}
			priorContextText.WriteString(fmt.Sprintf("--- Earlier context (chunk %d) ---\n%s", pc.ChunkIndex, pc.Text))
		}

		return fmt.Sprintf(`
%s

Your task:
%s

Earlier context:
---
%s
---

Current chunk to analyze:
---
%s
---

Return %s

Rules:
%s
`, strings.TrimSpace(setup), formatBulletList(tasks), priorContextText.String(), text, strings.TrimSpace(schema), formatBulletList(rules))
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

func correctEntityOffsets(chunk string, entities []ChunkEntityRef) {
	for i := range entities {
		entity := &entities[i]
		if entity.StartOffsets == nil {
			entity.StartOffsets = []int{}
		}

		expected := findAllOccurrences(chunk, entity.Name)
		reported := dedupeAndSort(entity.StartOffsets)

		if !equalIntSlices(expected, reported) {
			log.Printf("LLM offsets mismatch for entity %q: provided=%v corrected=%v", entity.Name, reported, expected)
			entity.StartOffsets = expected
		} else {
			entity.StartOffsets = reported
		}
	}
}

func findAllOccurrences(text, needle string) []int {
	if strings.TrimSpace(needle) == "" {
		return []int{}
	}
	var positions []int
	offset := 0
	for {
		idx := strings.Index(text[offset:], needle)
		if idx == -1 {
			break
		}
		positions = append(positions, offset+idx)
		offset += idx + len(needle)
	}
	return positions
}

func dedupeAndSort(values []int) []int {
	if len(values) == 0 {
		return []int{}
	}
	unique := make(map[int]struct{}, len(values))
	for _, v := range values {
		if v >= 0 {
			unique[v] = struct{}{}
		}
	}
	result := make([]int, 0, len(unique))
	for v := range unique {
		result = append(result, v)
	}
	sort.Ints(result)
	return result
}

func equalIntSlices(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
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
