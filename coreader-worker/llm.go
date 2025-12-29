package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

// What we send into the LLM to describe an entity.
type EntityDescriptionInput struct {
	EntityName string
	EntityType string // optional, e.g. "character", "place"
	BookTitle  string // optional, just for nicer prompts
	Context    string // text from chunks (already concatenated)
}

// What we expect back from the LLM as JSON.
type EntityDescription struct {
	Name                   string   `json:"name"`
	Summary                string   `json:"summary"`
	Role                   string   `json:"role,omitempty"`
	Traits                 []string `json:"traits,omitempty"`
	ImportantLocations     []string `json:"importantLocations,omitempty"`
	ImportantRelationships []string `json:"importantRelationships,omitempty"`
}

// =======================
// Ollama / LLM client
// =======================

type LLMClient struct {
	BaseURL string
	Model   string
	Client  *http.Client
}

func NewLLMClientFromEnv() *LLMClient {
	base := os.Getenv("LLM_BASE_URL")
	if base == "" {
		base = "http://llm:11434"
	}
	model := os.Getenv("LLM_ENTITY_MODEL")
	if model == "" {
		model = "phi3:mini" // default
	}

	return &LLMClient{
		BaseURL: strings.TrimRight(base, "/"),
		Model:   model,
		Client:  &http.Client{Timeout: 60 * time.Second},
	}
}

type OllamaOptions struct {
	Temperature float32 `json:"temperature,omitempty"`
	TopP        float32 `json:"top_p,omitempty"`
	TopK        int     `json:"top_k,omitempty"`
	NumCtx      int     `json:"num_ctx,omitempty"`
	Seed        int     `json:"seed,omitempty"`
}

// internal struct to talk to Ollama /api/generate
type ollamaGenerateRequest struct {
	Model   string         `json:"model"`
	Prompt  string         `json:"prompt"`
	Stream  bool           `json:"stream"`
	Format  string         `json:"format,omitempty"` // e.g. "json"
	Options *OllamaOptions `json:"options,omitempty"`
}

type ollamaGenerateResponse struct {
	Response string `json:"response"`
	// other fields exist but we don't care for now
}

type BookHeaderMetadata struct {
	HasHeader       bool     `json:"hasHeader"`
	Title           string   `json:"title"`
	Author          string   `json:"author"`
	Subtitle        string   `json:"subtitle"`
	Edition         string   `json:"edition"`
	Publisher       string   `json:"publisher"`
	Series          string   `json:"series"`
	Language        string   `json:"language"`
	TableOfContents []string `json:"tableOfContents"` // raw chapter lines if found
	HeaderEndOffset int      `json:"headerEndOffset"` // char index where main story starts in this chunk
}

type ChunkLLMMetadata struct {
	Entities        []ChunkEntityRef `json:"entities,omitempty"`
	HasChapterStart bool             `json:"hasChapterStart,omitempty"`
	ChapterTitle    string           `json:"chapterTitle,omitempty"`
	ChapterNumber   string           `json:"chapterNumber,omitempty"`
}

// Public function: given entity info + context, ask LLM for a description.
func (c *LLMClient) DescribeEntity(ctx context.Context, in EntityDescriptionInput) (*EntityDescription, error) {
	if c.Client == nil {
		c.Client = &http.Client{Timeout: 60 * time.Second}
	}

	prompt := buildEntityDescriptionPrompt(in)

	reqBody, err := json.Marshal(ollamaGenerateRequest{
		Model:  c.Model,
		Prompt: prompt,
		Stream: false,
		Format: "json",
		Options: &OllamaOptions{
			Temperature: 0.1,
			TopP:        0.9,
			NumCtx:      4096,
			Seed:        123, // deterministic
		},
	})
	if err != nil {
		return nil, fmt.Errorf("marshal ollama request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/api/generate", bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call ollama: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama returned status %d", resp.StatusCode)
	}

	var genResp ollamaGenerateResponse
	if err := json.NewDecoder(resp.Body).Decode(&genResp); err != nil {
		return nil, fmt.Errorf("decode ollama response: %w", err)
	}

	// Now parse the model's "response" as JSON into EntityDescription
	var desc EntityDescription
	if err := json.Unmarshal([]byte(genResp.Response), &desc); err != nil {
		return nil, fmt.Errorf("parse llm JSON: %w\nraw=%s", err, genResp.Response)
	}

	// If model didn't fill name, set it from input
	if desc.Name == "" {
		desc.Name = in.EntityName
	}

	return &desc, nil
}

// =======================
// Prompt builder
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

	// You can later tune this for spoiler level, etc.
	return fmt.Sprintf(`
You are an assistant that summarises entities in books.

Your task:
- Read the context.
- Describe the entity "%s"%s.
- Use ONLY the information in the context.
- DO NOT invent details that are not supported by the context.

Context:
---
%s
---

Return STRICTLY a JSON object with this schema (no extra text):

{
  "name": string,
  "summary": string,
  "role": string,
  "traits": string[],
  "importantLocations": string[],
  "importantRelationships": string[]
}

Rules:
- "summary" is a short neutral description (2–4 sentences max).
- "role" is a short phrase like "main protagonist", "supporting character", "antagonist", "location", etc.
- "traits" is a list of key attributes (e.g. ["brave","impulsive"]).
- "importantLocations" is a list of place names strongly tied to this entity.
- "importantRelationships" is a list of important people or entities they are connected to.
- If some fields are unknown, use empty string or empty array.
`, entityLabel, bookPart, in.Context)
}

// AnalyzeChunk sends a TextChunk to the LLM and returns structured metadata.
func (c *LLMClient) AnalyzeChunk(ctx context.Context, bookTitle string, chunk string) (*ChunkLLMMetadata, error) {
	if strings.TrimSpace(chunk) == "" {
		// empty chunk → no entities
		return &ChunkLLMMetadata{
			Entities:        []ChunkEntityRef{},
			HasChapterStart: false,
		}, nil
	}

	if c.Client == nil {
		c.Client = &http.Client{Timeout: 60 * time.Second}
	}

	prompt := buildChunkAnalysisPrompt(bookTitle, chunk)

	reqPayload := ollamaGenerateRequest{
		Model:  c.Model,
		Prompt: prompt,
		Format: "json",
		Stream: false,
		Options: &OllamaOptions{
			Temperature: 0.1,
			// TopP:        0.9,
			// NumCtx:      4096,
			// Seed:        42,
		},
	}

	body, err := json.Marshal(reqPayload)
	if err != nil {
		return nil, fmt.Errorf("marshal ollama request: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.BaseURL+"/api/generate",
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call ollama: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama returned status %d", resp.StatusCode)
	}

	var genResp ollamaGenerateResponse
	if err := json.NewDecoder(resp.Body).Decode(&genResp); err != nil {
		return nil, fmt.Errorf("decode ollama response: %w", err)
	}

	// Parse JSON from "response" into our metadata struct
	var meta ChunkLLMMetadata
	if err := json.Unmarshal([]byte(genResp.Response), &meta); err != nil {
		return nil, fmt.Errorf("parse llm JSON: %w\nraw=%s", err, genResp.Response)
	}

	// Normalize nil slice
	if meta.Entities == nil {
		meta.Entities = []ChunkEntityRef{}
	}

	return &meta, nil
}

func buildChunkAnalysisPrompt(bookTitle, text string) string {
	bookPart := ""
	if strings.TrimSpace(bookTitle) != "" {
		bookPart = fmt.Sprintf(" from the book \"%s\"", bookTitle)
	}

	return fmt.Sprintf(`
You are an assistant that analyzes a single chunk of text%[1]s.

Your task:
- Find all named entities of interest: CHARACTERS, PLACES, SPELLS, SONGS, ARTIFACTS, OTHER.
- Work ONLY within this chunk. You do NOT have the rest of the book.
- Mark whether each entity appears to be introduced for the first time in THIS CHUNK (local, not global to the book).
- If this chunk looks like it starts a new chapter (e.g. "Chapter 3", "Capitolul 2", etc.), mark that and extract the chapter number/title.

Chunk:
---
%[2]s
---

Return STRICTLY a JSON object with this structure (no extra text):

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
  "hasChapterStart": boolean,
  "chapterTitle": string,
  "chapterNumber": string
}

Rules:
- "startOffset" and "endOffset" are 0-based character indices into the given chunk text.
- "endOffset" is exclusive.
- If you are not sure about offsets, approximate as best as you can.
- If no entities are found, use an empty array for "entities".
- If there is no chapter start, "hasChapterStart" must be false and title/number can be empty strings.
`, bookPart, text)
}

func (c *LLMClient) AnalyzeBookHeader(ctx context.Context, chunk string) (*BookHeaderMetadata, error) {
	if strings.TrimSpace(chunk) == "" {
		return &BookHeaderMetadata{
			HasHeader:       false,
			HeaderEndOffset: 0,
		}, nil
	}

	if c.Client == nil {
		c.Client = &http.Client{Timeout: 60 * time.Second}
	}

	prompt := buildBookHeaderPrompt(chunk)

	fmt.Println(prompt)

	reqPayload := ollamaGenerateRequest{
		Model:  c.Model,
		Prompt: prompt,
		Format: "json",
		Stream: false,
		Options: &OllamaOptions{
			Temperature: 0.1,
			TopP:        0.9,
			NumCtx:      4096,
			Seed:        101, // deterministic-ish
		},
	}

	body, err := json.Marshal(reqPayload)
	if err != nil {
		return nil, fmt.Errorf("marshal ollama request: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.BaseURL+"/api/generate",
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call ollama: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama returned status %d", resp.StatusCode)
	}

	var genResp ollamaGenerateResponse
	if err := json.NewDecoder(resp.Body).Decode(&genResp); err != nil {
		return nil, fmt.Errorf("decode ollama response: %w", err)
	}

	var meta BookHeaderMetadata
	if err := json.Unmarshal([]byte(genResp.Response), &meta); err != nil {
		return nil, fmt.Errorf("parse llm JSON: %w\nraw=%s", err, genResp.Response)
	}

	// Some normalization
	if meta.HeaderEndOffset < 0 {
		meta.HeaderEndOffset = 0
	}

	return &meta, nil
}

func buildBookHeaderPrompt(chunkText string) string {
	return fmt.Sprintf(`
You analyze the beginning of a book text. It may contain a header/antet with metadata and a table of contents.

Your task:
- Detect if there is a book header (with title, author, edition, publisher. etc.).

Chunk:
---
%s
---

Return ONLY valid JSON with this structure:

{
  "hasHeader": boolean,
  "title": string,
  "author": string,
  "subtitle": string,
  "edition": string,
  "publisher": string,
  "series": string,
  "language": string,
  "headerEndOffset": number
}

Rules:
- If you are not sure about a field, use an empty string.
- "headerEndOffset" is the 0-based character index in the given chunk where the main book content begins.
- If there is NO header and the text begins immediately with the story, set "hasHeader" = false and "headerEndOffset" = 0.
`, chunkText)
}
