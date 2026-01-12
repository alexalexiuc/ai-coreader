package llm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"sort"
	"strings"
)

// AnalyzeChunk sends a TextChunk to the LLM and returns structured metadata.
// This is a helper function that works with any Client implementation.
func AnalyzeChunk(ctx context.Context, client LLMClient, bookTitle string, chunk string) (*ChunkLLMMetadata, error) {
	if strings.TrimSpace(chunk) == "" {
		// empty chunk → no entities
		return &ChunkLLMMetadata{
			Entities: []ChunkEntityRef{},
			Chapters: []string{},
		}, nil
	}

	meta, err := analyzeChunkOnce(ctx, client, bookTitle, chunk)
	if err == nil {
		correctEntityOffsets(chunk, meta.Entities)
		return meta, nil
	}

	var parseErr chunkParseError
	if errors.As(err, &parseErr) {
		retried, retryErr := analyzeChunkWithSplitRetry(ctx, client, bookTitle, chunk)
		if retryErr == nil {
			return retried, nil
		}
		return nil, retryErr
	}

	return nil, err
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

func buildChunkAnalysisPrompt(bookTitle, text string) string {
	bookPart := ""
	if strings.TrimSpace(bookTitle) != "" {
		bookPart = fmt.Sprintf(" from the book \"%s\"", bookTitle)
	}

	setup := fmt.Sprintf("You are an assistant that analyzes a single chunk of text%s.", bookPart)
	tasks := []string{
		"Find named entities of interest: CHARACTERS, PLACES, ORGANIZATIONS, ARTIFACTS, EVENTS, WORKS (book titles), and other notable named concepts.",
		"Work ONLY within this chunk. You do NOT have the rest of the book.",
		"Detect every chapter heading present in the chunk (e.g. \"Chapter 3\", \"Part II\", or similar). Include all chapter headings found, not just the first.",
	}
	schema := `STRICTLY a JSON object with this structure (no extra text):

{
	"entities": [
    {
      "name": string,
      "type": "character" | "place" | "organization" | "artifact" | "event" | "work" | "other"
    }
  ],
  "chapters": string[]
}`
	rules := []string{
		"Only include entities that are explicitly named or titled (proper nouns, capitalized names, or quoted titles).",
		"Ignore generic objects, common nouns, plants/animals/food, or one-off incidental items unless they are uniquely named.",
		"Be CONSERVATIVE: do not extract vague, ambiguous, or overly generic entities (like \"the wizard\", \"the city\", \"the organization\").",
		"Require specific names: \"Gandalf\" (not \"the wizard\"), \"London\" (not \"the city\"), \"Hogwarts\" (not \"the school\").",
		"Skip pronouns, job titles, family relations (\"his brother\", \"the captain\") unless used as proper names.",
		"Skip common items, everyday objects, body parts, weather, emotions, or abstract concepts unless they are uniquely named (e.g., \"The Dark Mark\" is okay, \"darkness\" is not).",
		"type MUST be exactly one of the allowed strings above. If unsure, set type = \"other\"",
		"Each entity should be listed only ONCE with its name and type.",
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

func correctEntityOffsets(chunk string, entities []ChunkEntityRef) {
	for i := range entities {
		entity := &entities[i]
		// Compute all occurrences of the entity name in the chunk
		entity.StartOffsets = findAllOccurrences(chunk, entity.Name)
		if len(entity.StartOffsets) == 0 {
			log.Printf("Warning: Entity %q not found in chunk text", entity.Name)
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

type chunkParseError struct {
	err      error
	response string
}

func (e chunkParseError) Error() string {
	return e.err.Error()
}

func (e chunkParseError) Unwrap() error {
	return e.err
}

func analyzeChunkOnce(ctx context.Context, client LLMClient, bookTitle string, chunk string) (*ChunkLLMMetadata, error) {
	prompt := buildChunkAnalysisPrompt(bookTitle, chunk)

	options := Options{
		Temperature: 0.1,
		Format:      ChunkMetadataFormat(),
	}

	response, err := client.GenerateCompletion(ctx, prompt, options)
	logRequest(ctx, "AnalyzeChunk", prompt, &options, response, err)
	if err != nil {
		return nil, err
	}

	meta, err := parseChunkMetadata(response)
	if err != nil {
		return nil, chunkParseError{err: fmt.Errorf("parse llm JSON: %w\nraw=%s", err, response), response: response}
	}

	return meta, nil
}

func analyzeChunkWithSplitRetry(ctx context.Context, client LLMClient, bookTitle string, chunk string) (*ChunkLLMMetadata, error) {
	parts := splitChunkForRetry(chunk)
	if len(parts) < 2 {
		return nil, fmt.Errorf("split retry failed: chunk too small to split safely")
	}

	merged := &ChunkLLMMetadata{
		Entities: []ChunkEntityRef{},
		Chapters: []string{},
	}

	for _, part := range parts {
		if strings.TrimSpace(part) == "" {
			continue
		}
		meta, err := analyzeChunkOnce(ctx, client, bookTitle, part)
		if err != nil {
			log.Printf("Warning: split retry AnalyzeChunk failed: %v", err)
			continue
		}
		merged.Entities = append(merged.Entities, meta.Entities...)
		merged.Chapters = append(merged.Chapters, meta.Chapters...)
	}

	if len(merged.Entities) == 0 && len(merged.Chapters) == 0 {
		return nil, fmt.Errorf("split retry failed: no valid subresponses")
	}

	merged.Entities = normalizeChunkEntities(merged.Entities)
	merged.Chapters = normalizeChapters(merged.Chapters)
	correctEntityOffsets(chunk, merged.Entities)

	return merged, nil
}

func parseChunkMetadata(response string) (*ChunkLLMMetadata, error) {
	var meta ChunkLLMMetadata
	if err := json.Unmarshal([]byte(response), &meta); err != nil {
		return nil, err
	}

	if meta.Entities == nil {
		meta.Entities = []ChunkEntityRef{}
	}
	if meta.Chapters == nil {
		meta.Chapters = []string{}
	}

	meta.Entities = normalizeChunkEntities(meta.Entities)
	meta.Chapters = normalizeChapters(meta.Chapters)

	return &meta, nil
}

func normalizeChunkEntities(entities []ChunkEntityRef) []ChunkEntityRef {
	allowedTypes := map[string]struct{}{
		"character":    {},
		"place":        {},
		"organization": {},
		"artifact":     {},
		"event":        {},
		"work":         {},
		"other":        {},
	}

	result := make([]ChunkEntityRef, 0, len(entities))
	seen := make(map[string]struct{}, len(entities))
	for _, entity := range entities {
		name := strings.TrimSpace(entity.Name)
		if name == "" {
			continue
		}
		entityType := strings.ToLower(strings.TrimSpace(entity.Type))
		if entityType == "" {
			entityType = "other"
		}
		if _, ok := allowedTypes[entityType]; !ok {
			continue
		}

		key := strings.ToLower(name) + "|" + entityType
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, ChunkEntityRef{
			Name: name,
			Type: entityType,
		})
	}

	return result
}

func normalizeChapters(chapters []string) []string {
	result := make([]string, 0, len(chapters))
	seen := make(map[string]struct{}, len(chapters))
	for _, chapter := range chapters {
		clean := strings.TrimSpace(chapter)
		if clean == "" {
			continue
		}
		key := strings.ToLower(clean)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, clean)
	}
	return result
}

func splitChunkForRetry(chunk string) []string {
	runes := []rune(chunk)
	if len(runes) < 2 {
		return []string{chunk}
	}

	mid := len(runes) / 2
	splitAt := findNearestParagraphBreak(runes, mid)
	if splitAt <= 0 || splitAt >= len(runes) {
		splitAt = mid
	}

	left := strings.TrimSpace(string(runes[:splitAt]))
	right := strings.TrimSpace(string(runes[splitAt:]))
	return []string{left, right}
}

func findNearestParagraphBreak(runes []rune, mid int) int {
	for offset := range runes {
		left := mid - offset
		if left > 0 && runes[left-1] == '\n' && runes[left] == '\n' {
			return left + 1
		}
		right := mid + offset
		if right > 0 && right < len(runes) && runes[right-1] == '\n' && runes[right] == '\n' {
			return right + 1
		}
	}
	return mid
}
