package main

import (
	"context"
	"coreader-worker/llm"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"strings"
	"time"
	"unicode"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	SNIPPET_CONTEXT_CHARS         = 250 // Characters before and after mention for context
	MAX_FACTS_FOR_DISTILLATION    = 50  // Max facts to include in distillation
	MAX_SNIPPETS_FOR_DISTILLATION = 10  // Max snippets to include in distillation
	EARLY_MENTION_COUNT           = 3   // Number of early mentions to prioritize
)

// PostProcessEntityDescriptions runs after all chunks are processed
// It creates canonical entity records and distills descriptions
func (w *Worker) PostProcessEntityDescriptions(ctx context.Context, bookID primitive.ObjectID) error {
	log.Printf("Starting entity post-processing for book %s", bookID.Hex())

	// Get all chunks with entities for this book
	chunks, err := w.db.GetBookChunksWithEntities(bookID)
	if err != nil {
		return fmt.Errorf("failed to get chunks with entities: %w", err)
	}

	if len(chunks) == 0 {
		log.Printf("No chunks with entities found for book %s", bookID.Hex())
		return nil
	}

	// Group entities by normalized key (name+type)
	entityGroups := make(map[string]*entityGroup)
	for _, chunk := range chunks {
		for _, entityRef := range chunk.Entities {
			key := normalizeEntityKey(entityRef.Name, entityRef.Type)
			if group, exists := entityGroups[key]; exists {
				group.mentions = append(group.mentions, chunkMention{
					chunk:     chunk,
					entityRef: entityRef,
				})
			} else {
				entityGroups[key] = &entityGroup{
					name:     entityRef.Name,
					typ:      entityRef.Type,
					mentions: []chunkMention{{chunk: chunk, entityRef: entityRef}},
				}
			}
		}
	}

	log.Printf("Found %d unique entities across %d chunks", len(entityGroups), len(chunks))

	// Process each entity group
	for key, group := range entityGroups {
		if err := ctx.Err(); err != nil {
			return fmt.Errorf("context cancelled during entity processing: %w", err)
		}

		if err := w.processEntityGroup(ctx, bookID, key, group); err != nil {
			log.Printf("Warning: Failed to process entity %q (type=%s): %v", group.name, group.typ, err)
			// Continue with other entities
		}
	}

	log.Printf("Completed entity post-processing for book %s", bookID.Hex())
	return nil
}

type entityGroup struct {
	name     string
	typ      string
	mentions []chunkMention
}

type chunkMention struct {
	chunk     *BookChunksDoc
	entityRef ChunkEntityRef
}

func normalizeEntityKey(name, typ string) string {
	return strings.ToLower(strings.TrimSpace(name)) + "|" + strings.ToLower(strings.TrimSpace(typ))
}

func (w *Worker) processEntityGroup(ctx context.Context, bookID primitive.ObjectID, key string, group *entityGroup) error {
	// 1. Create or get canonical entity
	entity, err := w.db.UpsertEntity(bookID, group.name, group.typ, len(group.mentions), group.mentions)
	if err != nil {
		return fmt.Errorf("failed to upsert entity: %w", err)
	}

	log.Printf("Processing entity %q (type=%s) with %d mentions", group.name, group.typ, len(group.mentions))

	// 2. Create entity mentions and extract facts
	for i, mention := range group.mentions {
		if err := ctx.Err(); err != nil {
			return fmt.Errorf("context cancelled: %w", err)
		}

		// Check if mention already processed (idempotent)
		exists, err := w.db.EntityMentionExists(bookID, entity.ID, mention.chunk.ID)
		if err != nil {
			log.Printf("Warning: Failed to check mention existence: %v", err)
		}
		if exists {
			continue
		}

		snippet := extractSnippet(mention.chunk.Text, mention.entityRef.StartOffsets)

		// Create mention record
		mentionDoc := &EntityMentionsDoc{
			BookID:      bookID,
			EntityID:    entity.ID,
			ChunkID:     mention.chunk.ID,
			ChunkIndex:  mention.chunk.Index,
			SurfaceForm: mention.entityRef.Name,
			Offsets:     mention.entityRef.StartOffsets,
			Snippet:     snippet,
		}

		// Extract facts from snippet
		facts, err := llm.ExtractEntityFacts(ctx, w.llmClient, group.name, group.typ, snippet)
		if err != nil {
			log.Printf("Warning: Failed to extract facts for entity %q in chunk %d: %v", group.name, mention.chunk.Index, err)
			// Continue without facts
		} else {
			// Convert to inline struct type and add hashes
			inlineFacts := make([]struct {
				FactType   string  `bson:"factType" json:"factType"`
				Value      string  `bson:"value" json:"value"`
				Confidence float64 `bson:"confidence" json:"confidence"`
				Evidence   string  `bson:"evidence,omitempty" json:"evidence,omitempty"`
				Hash       string  `bson:"hash,omitempty" json:"hash,omitempty"`
			}, len(facts))

			for i, fact := range facts {
				inlineFacts[i].FactType = fact.FactType
				inlineFacts[i].Value = fact.Value
				inlineFacts[i].Confidence = fact.Confidence
				inlineFacts[i].Evidence = fact.Evidence
				inlineFacts[i].Hash = hashFact(fact)
			}
			mentionDoc.FactsExtracted = inlineFacts
		}

		// Store mention
		_, err = w.db.CreateEntityMention(mentionDoc)
		if err != nil {
			return fmt.Errorf("failed to create entity mention: %w", err)
		}

		if (i+1)%10 == 0 {
			log.Printf("Processed %d/%d mentions for entity %q", i+1, len(group.mentions), group.name)
		}
	}

	// 3. Distill entity description
	if err := w.distillEntityDescription(ctx, bookID, entity); err != nil {
		return fmt.Errorf("failed to distill description: %w", err)
	}

	return nil
}

func extractSnippet(text string, offsets []int) string {
	// Convert to runes to handle multi-byte UTF-8 characters correctly
	runes := []rune(text)

	if len(offsets) == 0 {
		// Return first N chars if no offsets
		if len(runes) <= SNIPPET_CONTEXT_CHARS {
			return strings.TrimSpace(text)
		}
		// Find a good boundary instead of cutting at arbitrary position
		boundary := findSnippetBoundary(runes, SNIPPET_CONTEXT_CHARS, min(SNIPPET_CONTEXT_CHARS+50, len(runes)))
		if boundary == -1 {
			boundary = SNIPPET_CONTEXT_CHARS
		}
		return strings.TrimSpace(string(runes[:boundary]))
	}

	// If multiple mentions in chunk, try to include them all in a larger window
	// Find min and max offsets to determine span
	minOffset := offsets[0]
	maxOffset := offsets[0]
	for _, offset := range offsets {
		if offset < minOffset {
			minOffset = offset
		}
		if offset > maxOffset {
			maxOffset = offset
		}
	}

	// Expand window around the span of mentions
	start := max(0, minOffset-SNIPPET_CONTEXT_CHARS)
	end := min(len(runes), maxOffset+SNIPPET_CONTEXT_CHARS)

	// If the resulting snippet is too large, extract max available chars with warning
	if end-start > SNIPPET_CONTEXT_CHARS*3 {
		log.Printf("Warning: Entity span too large (%d chars), extracting max %d chars around mentions",
			end-start, SNIPPET_CONTEXT_CHARS*3)

		// Try to center on the span of mentions, but cap at 3x context
		spanCenter := (minOffset + maxOffset) / 2
		halfWindow := (SNIPPET_CONTEXT_CHARS * 3) / 2
		start = max(0, spanCenter-halfWindow)
		end = min(len(runes), start+SNIPPET_CONTEXT_CHARS*3)

		// Adjust start if we hit the end boundary
		if end == len(runes) && end-start < SNIPPET_CONTEXT_CHARS*3 {
			start = max(0, end-SNIPPET_CONTEXT_CHARS*3)
		}
	}

	// Adjust boundaries to avoid cutting words
	start = findSnippetStart(runes, start)
	end = findSnippetEnd(runes, end, min(end+50, len(runes)))

	snippet := string(runes[start:end])
	return strings.TrimSpace(snippet)
}

// findSnippetBoundary finds a good place to end a snippet, similar to findRuneBoundary in chunking.go
// Priorities: sentence end > comma > whitespace
func findSnippetBoundary(runes []rune, minIdx, maxIdx int) int {
	if minIdx >= len(runes) {
		return -1
	}
	if maxIdx > len(runes) {
		maxIdx = len(runes)
	}

	// 1) Sentence end: . ! ? followed by whitespace
	for i := maxIdx - 1; i >= minIdx; i-- {
		if runes[i] == '.' || runes[i] == '!' || runes[i] == '?' {
			if i+1 < len(runes) && unicode.IsSpace(runes[i+1]) {
				return i + 1
			}
		}
	}

	// 2) Comma + whitespace
	for i := maxIdx - 1; i >= minIdx; i-- {
		if runes[i] == ',' && i+1 < len(runes) && unicode.IsSpace(runes[i+1]) {
			return i + 1
		}
	}

	// 3) Last whitespace
	for i := maxIdx - 1; i >= minIdx; i-- {
		if unicode.IsSpace(runes[i]) {
			return i + 1
		}
	}

	return -1
}

// findSnippetStart adjusts the start position to begin at a word boundary
func findSnippetStart(runes []rune, start int) int {
	if start <= 0 || start >= len(runes) {
		return start
	}

	// If we're in the middle of a word, move forward to the next word boundary
	if !unicode.IsSpace(runes[start]) && start > 0 && !unicode.IsSpace(runes[start-1]) {
		// Look for next whitespace or punctuation within reasonable distance
		for i := start; i < len(runes) && i < start+30; i++ {
			if unicode.IsSpace(runes[i]) {
				// Skip the whitespace
				for i < len(runes) && unicode.IsSpace(runes[i]) {
					i++
				}
				return i
			}
		}
	}

	return start
}

// findSnippetEnd adjusts the end position to a natural boundary
func findSnippetEnd(runes []rune, end, maxEnd int) int {
	if end >= len(runes) {
		return len(runes)
	}

	// Try to find a good boundary
	boundary := findSnippetBoundary(runes, end, maxEnd)
	if boundary != -1 {
		return boundary
	}

	// If no good boundary found, at least don't cut in the middle of a word
	for i := end; i < maxEnd && i < len(runes); i++ {
		if unicode.IsSpace(runes[i]) {
			return i
		}
	}

	return end
}

func hashFact(fact llm.EntityFact) string {
	// Create deterministic hash for deduplication
	data := fmt.Sprintf("%s|%s|%s", fact.FactType, fact.Evidence, fact.Value)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

func (w *Worker) distillEntityDescription(ctx context.Context, bookID primitive.ObjectID, entity *EntitiesDoc) error {
	// Get all mentions with facts
	mentions, err := w.db.GetEntityMentions(entity.ID)
	if err != nil {
		return fmt.Errorf("failed to get entity mentions: %w", err)
	}

	if len(mentions) == 0 {
		log.Printf("No mentions found for entity %q", entity.NameCanonical)
		return nil
	}

	// Collect and deduplicate facts
	factMap := make(map[string]llm.EntityFact)
	var allSnippets []string

	for _, mention := range mentions {
		for _, factData := range mention.FactsExtracted {
			if factData.Hash != "" {
				if _, exists := factMap[factData.Hash]; !exists {
					// Convert from inline struct to llm.EntityFact
					fact := llm.EntityFact{
						FactType:   factData.FactType,
						Value:      factData.Value,
						Confidence: factData.Confidence,
						Evidence:   factData.Evidence,
						Hash:       factData.Hash,
					}
					factMap[factData.Hash] = fact
				}
			}
		}
		if mention.Snippet != "" {
			allSnippets = append(allSnippets, mention.Snippet)
		}
	}

	// Convert map to slice and select top facts
	var facts []llm.EntityFact
	for _, fact := range factMap {
		facts = append(facts, fact)
	}

	// Sort by confidence (simple selection)
	selectedFacts := selectTopFacts(facts, MAX_FACTS_FOR_DISTILLATION)

	// Select snippets: prioritize early mentions
	selectedSnippets := selectSnippets(mentions, allSnippets, MAX_SNIPPETS_FOR_DISTILLATION)

	// Call LLM to distill description
	input := llm.EntityDistillationInput{
		EntityName:         entity.NameCanonical,
		EntityType:         entity.Type,
		CurrentDescription: entity.DescriptionCurrent,
		Facts:              selectedFacts,
		Snippets:           selectedSnippets,
	}

	description, err := llm.DistillEntityDescription(ctx, w.llmClient, input)
	if err != nil {
		return fmt.Errorf("failed to distill description: %w", err)
	}

	// Update entity with new description
	if err := w.db.UpdateEntityDescription(entity.ID, description); err != nil {
		return fmt.Errorf("failed to update entity description: %w", err)
	}

	log.Printf("Updated description for entity %q (version %d)", entity.NameCanonical, entity.DescriptionVersion+1)
	return nil
}

func selectTopFacts(facts []llm.EntityFact, maxCount int) []llm.EntityFact {
	if len(facts) <= maxCount {
		return facts
	}

	// Simple selection: prioritize higher confidence facts
	// Could be improved with more sophisticated ranking
	selected := make([]llm.EntityFact, 0, maxCount)
	for i := 0; i < len(facts) && i < maxCount; i++ {
		selected = append(selected, facts[i])
	}
	return selected
}

func selectSnippets(mentions []EntityMentionsDoc, allSnippets []string, maxCount int) []string {
	if len(allSnippets) <= maxCount {
		return allSnippets
	}

	// Prioritize early mentions
	selected := make([]string, 0, maxCount)
	earlyCount := min(EARLY_MENTION_COUNT, maxCount/2)

	// Add early snippets
	for i := 0; i < len(mentions) && i < earlyCount && i < len(allSnippets); i++ {
		if mentions[i].Snippet != "" {
			selected = append(selected, mentions[i].Snippet)
		}
	}

	// Add remaining from later mentions
	remaining := maxCount - len(selected)
	step := len(mentions) / (remaining + 1)
	if step < 1 {
		step = 1
	}

	for i := earlyCount; i < len(mentions) && len(selected) < maxCount; i += step {
		if i < len(mentions) && mentions[i].Snippet != "" {
			selected = append(selected, mentions[i].Snippet)
		}
	}

	return selected
}

// DB Helper methods

func (db *DB) GetBookChunksWithEntities(bookID primitive.ObjectID) ([]*BookChunksDoc, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	filter := bson.M{
		"bookId":   bookID,
		"entities": bson.M{"$exists": true, "$ne": []interface{}{}},
	}

	opts := options.Find().SetSort(bson.D{{Key: "index", Value: 1}})
	cursor, err := db.BooksChunksCollection.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var chunks []*BookChunksDoc
	if err := cursor.All(ctx, &chunks); err != nil {
		return nil, err
	}

	return chunks, nil
}

func (db *DB) UpsertEntity(bookID primitive.ObjectID, name, typ string, mentionCount int, mentions []chunkMention) (*EntitiesDoc, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Find first and last chunk indices
	firstIdx := mentions[0].chunk.Index
	lastIdx := mentions[0].chunk.Index
	for _, m := range mentions {
		if m.chunk.Index < firstIdx {
			firstIdx = m.chunk.Index
		}
		if m.chunk.Index > lastIdx {
			lastIdx = m.chunk.Index
		}
	}

	filter := bson.M{
		"bookId":        bookID,
		"nameCanonical": name,
		"type":          typ,
	}

	update := bson.M{
		"$set": bson.M{
			"updatedAt":           time.Now().UTC(),
			"mentionCount":        mentionCount,
			"firstSeenChunkIndex": firstIdx,
			"lastSeenChunkIndex":  lastIdx,
		},
		"$setOnInsert": bson.M{
			"createdAt":          time.Now().UTC(),
			"bookId":             bookID,
			"nameCanonical":      name,
			"type":               typ,
			"descriptionVersion": 0,
		},
	}

	opts := options.FindOneAndUpdate().
		SetUpsert(true).
		SetReturnDocument(options.After)

	var entity EntitiesDoc
	err := db.EntitiesCollection.FindOneAndUpdate(ctx, filter, update, opts).Decode(&entity)
	if err != nil {
		return nil, err
	}

	return &entity, nil
}

func (db *DB) EntityMentionExists(bookID, entityID, chunkID primitive.ObjectID) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{
		"bookId":   bookID,
		"entityId": entityID,
		"chunkId":  chunkID,
	}

	count, err := db.EntityMentionsCollection.CountDocuments(ctx, filter)
	if err != nil {
		return false, err
	}

	return count > 0, nil
}

func (db *DB) CreateEntityMention(mention *EntityMentionsDoc) (*EntityMentionsDoc, error) {
	return InsertOneWithMeta(context.Background(), db.EntityMentionsCollection, mention)
}

func (db *DB) GetEntityMentions(entityID primitive.ObjectID) ([]EntityMentionsDoc, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	filter := bson.M{"entityId": entityID}
	opts := options.Find().SetSort(bson.D{{Key: "chunkIndex", Value: 1}})

	cursor, err := db.EntityMentionsCollection.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var mentions []EntityMentionsDoc
	if err := cursor.All(ctx, &mentions); err != nil {
		return nil, err
	}

	return mentions, nil
}

func (db *DB) UpdateEntityDescription(entityID primitive.ObjectID, description *llm.EntityDistillationResult) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	update := bson.M{
		"$set": bson.M{
			"descriptionCurrent": description.Description,
			"keyFacts":           description.KeyFacts,
			"uncertainties":      description.Uncertainties,
			"updatedAt":          time.Now().UTC(),
		},
		"$inc": bson.M{
			"descriptionVersion": 1,
		},
	}

	_, err := db.EntitiesCollection.UpdateByID(ctx, entityID, update)
	return err
}
