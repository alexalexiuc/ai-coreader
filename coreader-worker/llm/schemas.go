package llm

import "strings"

// JSONSchemaFormat describes a strict JSON schema format for LLM responses.
type JSONSchemaFormat struct {
	Name        string
	Description string
	Schema      any
}

func EntityDescriptionFormat() *JSONSchemaFormat {
	return &JSONSchemaFormat{
		Name:        "entity_description",
		Description: "Strict JSON output for entity description",
		Schema:      entityDescriptionSchema(),
	}
}

func ChunkMetadataFormat() *JSONSchemaFormat {
	return &JSONSchemaFormat{
		Name:        "chunk_metadata",
		Description: "Strict JSON output for chunk metadata",
		Schema:      chunkMetadataSchema(),
	}
}

func BookHeaderFormat() *JSONSchemaFormat {
	return &JSONSchemaFormat{
		Name:        "book_header",
		Description: "Strict JSON output for book header",
		Schema:      bookHeaderSchema(),
	}
}

// InferJSONSchemaFromPrompt picks the best schema for existing prompt templates.
// Your prompt builders include a JSON block with field names; we key off that.
func InferJSONSchemaFromPrompt(prompt string) *JSONSchemaFormat {
	p := strings.ToLower(prompt)

	// Entity description prompt
	if strings.Contains(p, `"importantlocations"`) && strings.Contains(p, `"importantrelationships"`) {
		return EntityDescriptionFormat()
	}

	// Chunk analysis prompt
	if strings.Contains(p, `"chapters"`) && strings.Contains(p, `"entities"`) {
		return ChunkMetadataFormat()
	}

	// Book header prompt
	if strings.Contains(p, `"hasheader"`) && strings.Contains(p, `"headerendoffset"`) && strings.Contains(p, `"publisher"`) {
		return BookHeaderFormat()
	}

	return nil
}

func entityDescriptionSchema() any {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required": []string{
			"name",
			"summary",
			"role",
			"traits",
			"importantLocations",
			"importantRelationships",
		},
		"properties": map[string]any{
			"name":    map[string]any{"type": "string"},
			"summary": map[string]any{"type": "string"},
			"role":    map[string]any{"type": "string"},
			"traits": map[string]any{
				"type":  "array",
				"items": map[string]any{"type": "string"},
			},
			"importantLocations": map[string]any{
				"type":  "array",
				"items": map[string]any{"type": "string"},
			},
			"importantRelationships": map[string]any{
				"type":  "array",
				"items": map[string]any{"type": "string"},
			},
		},
	}
}

func chunkMetadataSchema() any {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required": []string{
			"entities",
			"chapters",
		},
		"properties": map[string]any{
			"entities": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type":                 "object",
					"additionalProperties": false,
					"required": []string{
						"name",
						"type",
					},
					"properties": map[string]any{
						"name": map[string]any{"type": "string"},
						"type": map[string]any{
							"type": "string",
							"enum": []string{"character", "place", "spell", "song", "artifact", "organization", "work", "animal", "plant", "event", "other"},
						},
					},
				},
			},
			"chapters": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type": "string",
				},
			},
		},
	}
}

func bookHeaderSchema() any {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required": []string{
			"hasHeader",
			"title",
			"author",
			"subtitle",
			"edition",
			"publisher",
			"series",
			"language",
			"headerEndOffset",
		},
		"properties": map[string]any{
			"hasHeader": map[string]any{"type": "boolean"},
			"title":     map[string]any{"type": "string"},
			"author":    map[string]any{"type": "string"},
			"subtitle":  map[string]any{"type": "string"},
			"edition":   map[string]any{"type": "string"},
			"publisher": map[string]any{"type": "string"},
			"series":    map[string]any{"type": "string"},
			"language":  map[string]any{"type": "string"},
			"headerEndOffset": map[string]any{
				"type":    "integer",
				"minimum": 0,
			},
		},
	}
}
