package main

import (
	"context"
	"coreader-worker/llm"
	"coreader-worker/utils"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type fakeLLMClient struct {
	factCalls         int
	distillCalls      int
	lastFactsCount    int
	lastSnippetsCount int
}

func (f *fakeLLMClient) GenerateCompletion(ctx context.Context, prompt string, options llm.Options) (string, error) {
	if options.Format == nil {
		return "", fmt.Errorf("missing format")
	}
	switch options.Format.Name {
	case "entity_facts":
		f.factCalls++
		// Return many deterministic facts so distillation must cap inputs.
		facts := make([]llm.EntityFact, 0, 80)
		for i := 0; i < 80; i++ {
			facts = append(facts, llm.EntityFact{
				FactType:   "other",
				Value:      fmt.Sprintf("fact-%d", i),
				Confidence: 0.5 + (float64(i%10) / 20.0),
				Evidence:   "brave",
			})
		}
		b, _ := json.Marshal(map[string]any{"facts": facts})
		return string(b), nil
	case "entity_distillation":
		f.distillCalls++

		// Parse the SelectedFacts/SelectedSnippets blocks back out of the prompt and record sizes.
		factsJSON, snippetsJSON := extractJSONBlocksForTest(prompt)
		var facts []any
		var snippets []any
		_ = json.Unmarshal([]byte(factsJSON), &facts)
		_ = json.Unmarshal([]byte(snippetsJSON), &snippets)
		f.lastFactsCount = len(facts)
		f.lastSnippetsCount = len(snippets)

		return `{"description":"Alice is a character mentioned in the text.","keyFacts":["Mentioned as brave"],"uncertainties":[]}`, nil
	default:
		return "", fmt.Errorf("unexpected format: %s", options.Format.Name)
	}
}

func (f *fakeLLMClient) GenerateEmbedding(ctx context.Context, text string) ([]float32, error) {
	return []float32{0.1, 0.2}, nil
}

func extractJSONBlocksForTest(prompt string) (factsJSON string, snippetsJSON string) {
	fMarker := "SelectedFacts(JSON):"
	sMarker := "SelectedSnippets(JSON):"
	fIdx := strings.Index(prompt, fMarker)
	sIdx := strings.Index(prompt, sMarker)
	if fIdx == -1 || sIdx == -1 || sIdx <= fIdx {
		return "[]", "[]"
	}

	factsPart := prompt[fIdx+len(fMarker) : sIdx]
	snippetsPart := prompt[sIdx+len(sMarker):]
	return strings.TrimSpace(factsPart), strings.TrimSpace(snippetsPart)
}

type fakePostProcessStore struct {
	bookID   primitive.ObjectID
	entities map[primitive.ObjectID]EntityDescriptionsDoc
	chunks   []BookChunksDoc

	mentionsByKey map[string]EntityMentionsDoc
	mentionsByID  map[primitive.ObjectID]string
}

func newFakeStore(bookID primitive.ObjectID, entities []EntityDescriptionsDoc, chunks []BookChunksDoc) *fakePostProcessStore {
	entityMap := make(map[primitive.ObjectID]EntityDescriptionsDoc, len(entities))
	for _, e := range entities {
		entityMap[e.ID] = e
	}
	return &fakePostProcessStore{
		bookID:        bookID,
		entities:      entityMap,
		chunks:        chunks,
		mentionsByKey: make(map[string]EntityMentionsDoc),
		mentionsByID:  make(map[primitive.ObjectID]string),
	}
}

func (s *fakePostProcessStore) ListEntityDescriptionsByBook(ctx context.Context, bookID primitive.ObjectID) ([]EntityDescriptionsDoc, error) {
	out := make([]EntityDescriptionsDoc, 0, len(s.entities))
	for _, e := range s.entities {
		out = append(out, e)
	}
	return out, nil
}

func (s *fakePostProcessStore) ListBookChunksByBook(ctx context.Context, bookID primitive.ObjectID) ([]BookChunksDoc, error) {
	return append([]BookChunksDoc{}, s.chunks...), nil
}

func mentionKey(bookID, entityID, chunkID primitive.ObjectID, offset int) string {
	return fmt.Sprintf("%s|%s|%s|%d", bookID.Hex(), entityID.Hex(), chunkID.Hex(), offset)
}

func (s *fakePostProcessStore) CreateEntityMentionDocIgnoreDuplicate(ctx context.Context, mention *EntityMentionsDoc) (bool, error) {
	key := mentionKey(mention.BookID, mention.EntityID, mention.ChunkID, mention.OffsetStart)
	if _, ok := s.mentionsByKey[key]; ok {
		return false, nil
	}
	now := time.Now().UTC()
	if mention.ID.IsZero() {
		mention.ID = primitive.NewObjectID()
	}
	if mention.CreatedAt.IsZero() {
		mention.CreatedAt = now
	}
	mention.UpdatedAt = now
	s.mentionsByKey[key] = *mention
	s.mentionsByID[mention.ID] = key
	return true, nil
}

func (s *fakePostProcessStore) CreateEntityDescriptionWithID(ctx context.Context, entityDesc *EntityDescriptionsDoc) error {
	if _, exists := s.entities[entityDesc.ID]; exists {
		// Simulate duplicate key error
		return fmt.Errorf("duplicate key error")
	}
	now := time.Now().UTC()
	entityDesc.CreatedAt = now
	entityDesc.UpdatedAt = now
	s.entities[entityDesc.ID] = *entityDesc
	return nil
}

func (s *fakePostProcessStore) ListMentionsNeedingFacts(ctx context.Context, bookID primitive.ObjectID, limit int) ([]EntityMentionsDoc, error) {
	out := make([]EntityMentionsDoc, 0, limit)
	for _, m := range s.mentionsByKey {
		if m.BookID != bookID {
			continue
		}
		if len(m.FactsExtracted) == 0 {
			out = append(out, m)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.Before(out[j].CreatedAt) })
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func (s *fakePostProcessStore) SetEntityMentionFacts(ctx context.Context, mentionID primitive.ObjectID, facts []EntityFact) error {
	key, ok := s.mentionsByID[mentionID]
	if !ok {
		return fmt.Errorf("unknown mention id")
	}
	m := s.mentionsByKey[key]
	m.FactsExtracted = facts
	m.FactsExtractedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	s.mentionsByKey[key] = m
	return nil
}

func (s *fakePostProcessStore) AggregateEntityMentionStats(ctx context.Context, bookID primitive.ObjectID) (map[primitive.ObjectID]entityMentionStats, error) {
	type agg struct {
		count int
		min   int
		max   int
	}
	tmp := make(map[primitive.ObjectID]agg)
	for _, m := range s.mentionsByKey {
		if m.BookID != bookID {
			continue
		}
		a := tmp[m.EntityID]
		if a.count == 0 {
			a.min = m.ChunkIndex
			a.max = m.ChunkIndex
		} else {
			if m.ChunkIndex < a.min {
				a.min = m.ChunkIndex
			}
			if m.ChunkIndex > a.max {
				a.max = m.ChunkIndex
			}
		}
		a.count++
		tmp[m.EntityID] = a
	}
	out := make(map[primitive.ObjectID]entityMentionStats, len(tmp))
	for id, a := range tmp {
		out[id] = entityMentionStats{
			MentionCount:        a.count,
			FirstSeenChunkIndex: a.min,
			LastSeenChunkIndex:  a.max,
		}
	}
	return out, nil
}

func (s *fakePostProcessStore) UpdateEntityDescriptionMentionStats(ctx context.Context, entityID primitive.ObjectID, stats entityMentionStats) error {
	e := s.entities[entityID]
	e.MentionCount = stats.MentionCount
	e.FirstSeenChunkIndex = stats.FirstSeenChunkIndex
	e.LastSeenChunkIndex = stats.LastSeenChunkIndex
	e.UpdatedAt = time.Now().UTC()
	s.entities[entityID] = e
	return nil
}

func (s *fakePostProcessStore) ListMentionsForEntityWithFacts(ctx context.Context, bookID primitive.ObjectID, entityID primitive.ObjectID, limit int64) ([]EntityMentionsDoc, error) {
	out := make([]EntityMentionsDoc, 0)
	for _, m := range s.mentionsByKey {
		if m.BookID != bookID || m.EntityID != entityID {
			continue
		}
		if len(m.FactsExtracted) == 0 {
			continue
		}
		out = append(out, m)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].ChunkIndex == out[j].ChunkIndex {
			return out[i].OffsetStart < out[j].OffsetStart
		}
		return out[i].ChunkIndex < out[j].ChunkIndex
	})
	if int64(len(out)) > limit {
		out = out[:limit]
	}
	return out, nil
}

func (s *fakePostProcessStore) UpdateEntityDescriptionAfterDistillation(ctx context.Context, entityID primitive.ObjectID, summary string, mentionCount int) error {
	e := s.entities[entityID]
	e.Summary = summary
	e.DescriptionVersion++
	e.LastDistilledMentionCount = mentionCount
	e.DescriptionUpdatedAt = time.Now().UTC()
	e.UpdatedAt = time.Now().UTC()
	s.entities[entityID] = e
	return nil
}

func TestPostProcessEntityDescriptions_CreatesMentionsExtractsFactsAndCapsDistillInputs(t *testing.T) {
	ctx := context.Background()
	bookID := primitive.NewObjectID()
	// Use deterministic entity ID (simulating what processFile would create)
	entityID := utils.GenerateEntityID(bookID, "Alice", "character")
	chunk1ID := primitive.NewObjectID()
	chunk2ID := primitive.NewObjectID()

	// Start with NO entities - they should be created by PostProcess
	entities := []EntityDescriptionsDoc{}

	text1 := "Alice was brave. Alice went to Wonderland."
	text2 := "In Wonderland, Alice smiled."
	chunks := []BookChunksDoc{
		{
			ID:        chunk1ID,
			BookID:    bookID,
			Index:     0,
			Text:      text1,
			Entities:  []ChunkEntityRef{{EntityID: entityID, Name: "Alice", Type: "character", StartOffsets: []int{0, 17}}},
			CreatedAt: time.Now().UTC(),
			UpdatedAt: time.Now().UTC(),
		},
		{
			ID:        chunk2ID,
			BookID:    bookID,
			Index:     1,
			Text:      text2,
			Entities:  []ChunkEntityRef{{EntityID: entityID, Name: "Alice", Type: "character", StartOffsets: []int{15}}},
			CreatedAt: time.Now().UTC(),
			UpdatedAt: time.Now().UTC(),
		},
	}

	// Pre-create mentions (simulating what processFile would have created)
	store := newFakeStore(bookID, entities, chunks)

	// Create mentions manually to simulate processFile behavior
	for _, chunk := range chunks {
		for _, ent := range chunk.Entities {
			for _, offset := range ent.StartOffsets {
				snippet, snippetStart, snippetEnd := snippetAroundOffset(chunk.Text, offset, 250)
				mention := &EntityMentionsDoc{
					BookID:             bookID,
					EntityID:           ent.EntityID,
					ChunkID:            chunk.ID,
					ChunkIndex:         chunk.Index,
					SurfaceForm:        strings.TrimSpace(ent.Name),
					OffsetStart:        offset,
					Snippet:            snippet,
					SnippetStartOffset: snippetStart,
					SnippetEndOffset:   snippetEnd,
				}
				_, _ = store.CreateEntityMentionDocIgnoreDuplicate(ctx, mention)
			}
		}
	}

	llmClient := &fakeLLMClient{}

	if err := PostProcessEntityDescriptions(ctx, store, bookID, llmClient); err != nil {
		t.Fatalf("postprocess error: %v", err)
	}

	if got := len(store.mentionsByKey); got != 3 {
		t.Fatalf("expected 3 mentions, got %d", got)
	}

	for _, m := range store.mentionsByKey {
		if len(m.FactsExtracted) == 0 {
			t.Fatalf("expected facts extracted for mentionId=%s", m.ID.Hex())
		}
	}

	if llmClient.distillCalls != 1 {
		t.Fatalf("expected 1 distillation call, got %d", llmClient.distillCalls)
	}
	if llmClient.lastFactsCount > maxFactsForDistillation {
		t.Fatalf("facts cap exceeded: got %d max %d", llmClient.lastFactsCount, maxFactsForDistillation)
	}
	if llmClient.lastSnippetsCount > maxSnippetsForDistillation {
		t.Fatalf("snippets cap exceeded: got %d max %d", llmClient.lastSnippetsCount, maxSnippetsForDistillation)
	}

	// Re-run should be idempotent: no new mentions and no extra distillation after summary exists and thresholds don't change.
	prevMentions := len(store.mentionsByKey)
	prevDistills := llmClient.distillCalls
	if err := PostProcessEntityDescriptions(ctx, store, bookID, llmClient); err != nil {
		t.Fatalf("postprocess second run error: %v", err)
	}
	if len(store.mentionsByKey) != prevMentions {
		t.Fatalf("expected mentions unchanged on rerun")
	}
	if llmClient.distillCalls != prevDistills {
		t.Fatalf("expected no additional distillation on rerun")
	}
}
