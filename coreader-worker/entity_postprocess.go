package main

import (
	"context"
	"coreader-worker/llm"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"sort"
	"strings"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

const (
	mentionSnippetWindowChars = 250

	maxFactsForDistillation    = 60
	maxSnippetsForDistillation = 12

	firstMentionsForContext  = 3
	recentMentionsForContext = 3

	mentionsFactsBatchSize = 50
)

type entityMentionStats struct {
	MentionCount        int
	FirstSeenChunkIndex int
	LastSeenChunkIndex  int
}

type EntityPostProcessStore interface {
	ListEntityDescriptionsByBook(ctx context.Context, bookID primitive.ObjectID) ([]EntityDescriptionsDoc, error)
	ListBookChunksByBook(ctx context.Context, bookID primitive.ObjectID) ([]BookChunksDoc, error)

	CreateEntityMentionDocIgnoreDuplicate(ctx context.Context, mention *EntityMentionsDoc) (bool, error)
	CreateEntityDescriptionWithID(ctx context.Context, entityDesc *EntityDescriptionsDoc) error
	ListMentionsNeedingFacts(ctx context.Context, bookID primitive.ObjectID, limit int) ([]EntityMentionsDoc, error)
	SetEntityMentionFacts(ctx context.Context, mentionID primitive.ObjectID, facts []EntityFact) error

	AggregateEntityMentionStats(ctx context.Context, bookID primitive.ObjectID) (map[primitive.ObjectID]entityMentionStats, error)
	UpdateEntityDescriptionMentionStats(ctx context.Context, entityID primitive.ObjectID, stats entityMentionStats) error

	ListMentionsForEntityWithFacts(ctx context.Context, bookID primitive.ObjectID, entityID primitive.ObjectID, limit int64) ([]EntityMentionsDoc, error)
	UpdateEntityDescriptionAfterDistillation(ctx context.Context, entityID primitive.ObjectID, summary string, mentionCount int) error
}

// PostProcessEntityDescriptions runs after chunking/LLM chunk analysis completes to:
// 1) aggregate entity mentions into EntityDescriptions,
// 2) extract small, grounded facts per mention, and
// 3) periodically distill entity summaries using bounded evidence.
//
// It is designed to be idempotent: entity descriptions can be safely recreated/updated.
//
// FLOW: processFile creates EntityMentions directly during chunk processing with
// deterministic entity IDs. This function groups mentions by entityId, creates
// EntityDescriptions with aggregated data (mentionCount, firstSeen, lastSeen),
// extracts facts from mentions, and distills summaries. This makes EntityDescriptions
// truly the "analyzed output" rather than a placeholder.
func PostProcessEntityDescriptions(ctx context.Context, store EntityPostProcessStore, bookID primitive.ObjectID, llmClient llm.LLMClient) error {
	// Get all mentions for this book
	// Note: We're reusing ListBookChunksByBook to get chunks with entity refs,
	// but mentions are already created. We'll use them to build EntityDescriptions.
	chunks, err := store.ListBookChunksByBook(ctx, bookID)
	if err != nil {
		return fmt.Errorf("list chunks: %w", err)
	}

	// Aggregate entity info from mentions
	statsByEntityID, err := store.AggregateEntityMentionStats(ctx, bookID)
	if err != nil {
		return fmt.Errorf("aggregate mention stats: %w", err)
	}

	// Build map of entityID -> entity metadata from chunks
	entityMetadata := make(map[primitive.ObjectID]struct {
		Name string
		Type string
	})
	for _, chunk := range chunks {
		for _, ent := range chunk.Entities {
			if !ent.EntityID.IsZero() {
				entityMetadata[ent.EntityID] = struct {
					Name string
					Type string
				}{
					Name: ent.Name,
					Type: ent.Type,
				}
			}
		}
	}

	// Create EntityDescriptions for each unique entity
	createdDescriptions := 0
	entityByID := make(map[primitive.ObjectID]EntityDescriptionsDoc)

	// First, load existing entities (for idempotency on reruns)
	existingEntities, err := store.ListEntityDescriptionsByBook(ctx, bookID)
	if err != nil {
		return fmt.Errorf("list existing entities: %w", err)
	}
	for _, e := range existingEntities {
		entityByID[e.ID] = e
	}

	// Then create or update stats for all entities found in mentions
	for entityID, stats := range statsByEntityID {
		meta, ok := entityMetadata[entityID]
		if !ok {
			log.Printf("Warning: entity %s has mentions but no metadata in chunks", entityID.Hex())
			continue
		}

		// Check if entity already exists
		if existing, exists := entityByID[entityID]; exists {
			// Update stats on existing entity
			existing.MentionCount = stats.MentionCount
			existing.FirstSeenChunkIndex = stats.FirstSeenChunkIndex
			existing.LastSeenChunkIndex = stats.LastSeenChunkIndex
			entityByID[entityID] = existing
			err := store.UpdateEntityDescriptionMentionStats(ctx, entityID, stats)
			if err != nil {
				log.Printf("Warning: failed to update entity stats for %s: %v", meta.Name, err)
			}
		} else {
			// Create new EntityDescription
			entityDesc := &EntityDescriptionsDoc{
				ID:                  entityID,
				BookID:              bookID,
				BookChunkID:         primitive.NilObjectID,  // Not used in new flow
				BookChunkIds:        []primitive.ObjectID{}, // Will be computed if needed
				Name:                meta.Name,
				Type:                meta.Type,
				Summary:             "", // Will be filled by distillation
				MentionCount:        stats.MentionCount,
				FirstSeenChunkIndex: stats.FirstSeenChunkIndex,
				LastSeenChunkIndex:  stats.LastSeenChunkIndex,
			}

			err := store.CreateEntityDescriptionWithID(ctx, entityDesc)
			if err != nil {
				log.Printf("Warning: failed to create entity description for %s (%s): %v", meta.Name, meta.Type, err)
				continue
			}
			createdDescriptions++
			log.Printf("Created entity description: %s (%s) with %d mentions", meta.Name, meta.Type, stats.MentionCount)

			// Track for distillation
			entityByID[entityID] = *entityDesc
		}
	}
	log.Printf("Entity post-process: created %d entity descriptions (bookId=%s)", createdDescriptions, bookID.Hex())

	// Fact extraction: only for mentions that have not been processed yet.
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		mentions, err := store.ListMentionsNeedingFacts(ctx, bookID, mentionsFactsBatchSize)
		if err != nil {
			return fmt.Errorf("list mentions needing facts: %w", err)
		}
		if len(mentions) == 0 {
			break
		}

		for _, mention := range mentions {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			ent, ok := entityByID[mention.EntityID]
			if !ok {
				log.Printf("Warning: mention references missing entityId=%s; skipping mentionId=%s", mention.EntityID.Hex(), mention.ID.Hex())
				continue
			}

			facts, err := llm.ExtractEntityFactsFromSnippet(ctx, llmClient, llm.EntityFactsInput{
				EntityName: ent.Name,
				EntityType: ent.Type,
				Snippet:    mention.Snippet,
			})
			if err != nil {
				log.Printf("Warning: fact extraction failed mentionId=%s entityId=%s: %v", mention.ID.Hex(), mention.EntityID.Hex(), err)
				continue
			}

			dbFacts := make([]EntityFact, 0, len(facts))
			for _, fact := range facts {
				dbFacts = append(dbFacts, EntityFact{
					Hash:       hashFact(fact),
					FactType:   fact.FactType,
					Value:      fact.Value,
					Confidence: fact.Confidence,
					Evidence:   fact.Evidence,
				})
			}

			if err := store.SetEntityMentionFacts(ctx, mention.ID, dbFacts); err != nil {
				log.Printf("Warning: failed to store mention facts mentionId=%s: %v", mention.ID.Hex(), err)
				continue
			}
		}
	}

	// Distillation: update entity summaries with bounded facts/snippets.
	for entityID, ent := range entityByID {
		if !shouldDistillEntity(ent) {
			continue
		}

		mentions, err := store.ListMentionsForEntityWithFacts(ctx, bookID, entityID, 120)
		if err != nil {
			log.Printf("Warning: failed to list mentions for entityId=%s: %v", entityID.Hex(), err)
			continue
		}
		selectedFacts, selectedSnippets := selectDistillationInputs(mentions)
		if len(selectedFacts) == 0 && len(selectedSnippets) == 0 {
			continue
		}

		distilled, err := llm.DistillEntityDescription(ctx, llmClient, llm.EntityDistillationInput{
			EntityName:         ent.Name,
			EntityType:         ent.Type,
			CurrentDescription: ent.Summary,
			Facts:              toLLMDistillationFacts(selectedFacts),
			Snippets:           selectedSnippets,
		})
		if err != nil {
			log.Printf("Warning: distillation failed entityId=%s (%s): %v", entityID.Hex(), ent.Name, err)
			continue
		}

		if err := store.UpdateEntityDescriptionAfterDistillation(ctx, entityID, distilled.Description, ent.MentionCount); err != nil {
			log.Printf("Warning: failed to update entity description entityId=%s: %v", entityID.Hex(), err)
		}
	}

	return nil
}

func shouldDistillEntity(ent EntityDescriptionsDoc) bool {
	if strings.TrimSpace(ent.Summary) == "" {
		return true
	}

	mentionCount := ent.MentionCount
	if mentionCount <= 0 {
		return false
	}

	last := ent.LastDistilledMentionCount
	if last <= 0 {
		// Older docs may not have the field; allow one distillation when we have enough evidence.
		return mentionCount >= 3
	}

	nextThreshold := nextMentionThreshold(last)
	return mentionCount >= nextThreshold
}

func nextMentionThreshold(last int) int {
	thresholds := []int{1, 3, 5, 8, 13, 21, 34, 55, 89}
	for _, t := range thresholds {
		if t > last {
			return t
		}
	}
	return last + 34
}

func selectDistillationInputs(mentions []EntityMentionsDoc) ([]EntityFact, []string) {
	if len(mentions) == 0 {
		return nil, nil
	}

	sort.Slice(mentions, func(i, j int) bool { return mentions[i].ChunkIndex < mentions[j].ChunkIndex })

	selectedMentions := make([]EntityMentionsDoc, 0, firstMentionsForContext+recentMentionsForContext+10)

	// First mentions
	for i := 0; i < len(mentions) && i < firstMentionsForContext; i++ {
		selectedMentions = append(selectedMentions, mentions[i])
	}
	// Recent mentions
	for i := len(mentions) - 1; i >= 0 && len(mentions)-i <= recentMentionsForContext; i-- {
		selectedMentions = append(selectedMentions, mentions[i])
	}

	// Add a few high-confidence mentions (bounded by existing slice length).
	sort.Slice(mentions, func(i, j int) bool {
		return maxFactConfidence(mentions[i].FactsExtracted) > maxFactConfidence(mentions[j].FactsExtracted)
	})
	for i := 0; i < len(mentions) && i < 15; i++ {
		selectedMentions = append(selectedMentions, mentions[i])
	}

	factsByHash := make(map[string]EntityFact)
	snippets := make([]string, 0, maxSnippetsForDistillation)
	seenSnippetHashes := make(map[string]struct{})

	addSnippet := func(snippet string) {
		if len(snippets) >= maxSnippetsForDistillation {
			return
		}
		h := sha256.Sum256([]byte(snippet))
		key := hex.EncodeToString(h[:])
		if _, ok := seenSnippetHashes[key]; ok {
			return
		}
		seenSnippetHashes[key] = struct{}{}
		snippets = append(snippets, snippet)
	}

	for _, m := range selectedMentions {
		for _, f := range m.FactsExtracted {
			existing, ok := factsByHash[f.Hash]
			if !ok || f.Confidence > existing.Confidence {
				factsByHash[f.Hash] = f
			}
		}
		if strings.TrimSpace(m.Snippet) != "" {
			addSnippet(m.Snippet)
		}
	}

	facts := make([]EntityFact, 0, len(factsByHash))
	for _, f := range factsByHash {
		facts = append(facts, f)
	}
	sort.Slice(facts, func(i, j int) bool { return facts[i].Confidence > facts[j].Confidence })
	if len(facts) > maxFactsForDistillation {
		facts = facts[:maxFactsForDistillation]
	}

	return facts, snippets
}

func maxFactConfidence(facts []EntityFact) float64 {
	max := 0.0
	for _, f := range facts {
		if f.Confidence > max {
			max = f.Confidence
		}
	}
	return max
}

func toLLMDistillationFacts(facts []EntityFact) []llm.EntityFact {
	out := make([]llm.EntityFact, 0, len(facts))
	for _, f := range facts {
		out = append(out, llm.EntityFact{
			FactType:   f.FactType,
			Value:      f.Value,
			Confidence: f.Confidence,
			Evidence:   f.Evidence,
		})
	}
	return out
}

func snippetAroundOffset(text string, offsetChars int, windowChars int) (snippet string, startOffset int, endOffset int) {
	runes := []rune(text)
	if offsetChars < 0 {
		offsetChars = 0
	}
	if offsetChars > len(runes) {
		offsetChars = len(runes)
	}

	start := max(offsetChars-windowChars, 0)
	end := min(offsetChars+windowChars, len(runes))
	return string(runes[start:end]), start, end
}

func hashFact(f llm.EntityFact) string {
	payload := map[string]any{
		"factType":   f.FactType,
		"value":      f.Value,
		"evidence":   f.Evidence,
		"confidence": f.Confidence,
	}
	b, err := json.Marshal(payload)
	if err != nil {
		// Fallback: ensure hashing never fails; use fmt string.
		return sha256Hex(fmt.Sprintf("%v", payload))
	}
	return sha256Hex(string(b))
}

func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

func isDuplicateKeyError(err error) bool {
	if err == nil {
		return false
	}
	var we mongo.WriteException
	if errors.As(err, &we) {
		for _, e := range we.WriteErrors {
			if e.Code == 11000 {
				return true
			}
		}
	}

	var bwe mongo.BulkWriteException
	if errors.As(err, &bwe) {
		for _, e := range bwe.WriteErrors {
			if e.Code == 11000 {
				return true
			}
		}
	}

	if mongo.IsDuplicateKeyError(err) {
		return true
	}

	// mongo-go-driver doesn't expose a stable interface for all error wrappers; do a conservative check.
	return strings.Contains(err.Error(), "E11000 duplicate key")
}
