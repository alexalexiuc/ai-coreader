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
	"unicode/utf8"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	SNIPPET_CONTEXT_SENTENCES     = 2    // Sentences before and after mention for context
	MAX_SNIPPET_RUNES             = 1000 // Max runes in a snippet (fallback if sentence window too large)
	MAX_FACTS_FOR_DISTILLATION    = 50   // Max facts to include in distillation
	MAX_SNIPPETS_FOR_DISTILLATION = 10   // Max snippets to include in distillation
	EARLY_MENTION_COUNT           = 3    // Number of early mentions to prioritize
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

	totalEntities := len(entityGroups)
	processedEntities := 0
	startTime := time.Now()

	// Process each entity group
	for key, group := range entityGroups {
		if err := ctx.Err(); err != nil {
			return fmt.Errorf("context cancelled during entity processing: %w", err)
		}

		processedEntities++

		log.Printf("Processing entity %d/%d: %q (type=%s)", processedEntities, totalEntities, group.name, group.typ)
		if err := w.processEntityGroup(ctx, bookID, key, group); err != nil {
			log.Printf("Warning: Failed to process entity %q (type=%s): %v", group.name, group.typ, err)
			// Continue with other entities
		}
	}

	log.Printf("Completed entity post-processing for book %s in %s", bookID.Hex(), time.Since(startTime))
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

	// 2. Update chunk entities with the canonical entity ID
	for _, mention := range group.mentions {
		if err := w.db.UpdateChunkEntityID(mention.chunk.ID, group.name, group.typ, entity.ID); err != nil {
			log.Printf("Warning: Failed to update chunk entity ID for entity %q in chunk %s: %v", group.name, mention.chunk.ID.Hex(), err)
			// Non-fatal: continue processing
		}
	}

	// 3. Create entity mentions and extract facts
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

		// Normalize snippet for consistent processing
		snippet = normalizeSnippet(snippet)

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

		// Extract facts - handle large snippets by splitting
		facts, err := w.extractFactsFromSnippet(ctx, snippet, mention.entityRef.Name, mention.entityRef.StartOffsets, mention.chunk.Text, group.name, group.typ)
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

	// 4. Distill entity description
	if err := w.distillEntityDescription(ctx, bookID, entity); err != nil {
		return fmt.Errorf("failed to distill description: %w", err)
	}

	return nil
}

func extractSnippet(text string, offsets []int) string {
	// Convert to runes to handle multi-byte UTF-8 characters correctly
	runes := []rune(text)

	if len(offsets) == 0 {
		// No offsets - return first few sentences up to MAX_SNIPPET_RUNES
		sentences := splitIntoSentences(runes)
		return joinSentencesUpToLimit(runes, sentences, 0, MAX_SNIPPET_RUNES)
	}

	// Convert byte offsets to rune indices
	runeOffsets := make([]int, 0, len(offsets))
	for _, offset := range offsets {
		runeOffsets = append(runeOffsets, byteOffsetToRuneIndex(text, offset))
	}

	// Use the earliest mention offset to avoid spanning far-apart mentions
	targetOffset := runeOffsets[0]
	for _, offset := range runeOffsets {
		if offset < targetOffset {
			targetOffset = offset
		}
	}

	// Split text into sentences
	sentences := splitIntoSentences(runes)
	if len(sentences) == 0 {
		// Fallback if sentence splitting fails
		return extractFallbackSnippet(runes, targetOffset)
	}

	// Find the sentence containing the target offset
	targetSentenceIdx := -1
	for i, sent := range sentences {
		if targetOffset >= sent.startIdx && targetOffset < sent.endIdx {
			targetSentenceIdx = i
			break
		}
	}

	if targetSentenceIdx == -1 {
		// Target offset not in any sentence (shouldn't happen) - use fallback
		log.Printf("Warning: Entity mention offset %d not found in any sentence, using fallback", targetOffset)
		return extractFallbackSnippet(runes, targetOffset)
	}

	// Extract SNIPPET_CONTEXT_SENTENCES before and after the target sentence
	startSentenceIdx := max(0, targetSentenceIdx-SNIPPET_CONTEXT_SENTENCES)
	endSentenceIdx := min(len(sentences), targetSentenceIdx+SNIPPET_CONTEXT_SENTENCES+1)

	// Build snippet from selected sentences
	snippet := buildSnippetFromSentences(runes, sentences, startSentenceIdx, endSentenceIdx)

	// Log if snippet is large (caller will handle splitting)
	if len([]rune(snippet)) > MAX_SNIPPET_RUNES {
		log.Printf("Info: Sentence-window snippet is large (%d runes), caller should split for multiple LLM calls", len([]rune(snippet)))
	}

	// Verify snippet contains entity mention
	snippetStart := sentences[startSentenceIdx].startIdx
	snippetEnd := sentences[endSentenceIdx-1].endIdx
	if targetOffset < snippetStart || targetOffset >= snippetEnd {
		log.Printf("Warning: Entity mention lost in snippet extraction, using fallback")
		return extractFallbackSnippet(runes, targetOffset)
	}

	return strings.TrimSpace(snippet)
}

// sentence represents a sentence boundary in the text
type sentence struct {
	startIdx int
	endIdx   int
}

// splitIntoSentences splits runes into sentences based on sentence-ending punctuation
func splitIntoSentences(runes []rune) []sentence {
	var sentences []sentence
	sentStart := 0

	for i := 0; i < len(runes); i++ {
		// Sentence ends with . ! ? followed by whitespace or end of text
		if runes[i] == '.' || runes[i] == '!' || runes[i] == '?' {
			// Look ahead to confirm sentence boundary
			if i+1 >= len(runes) || unicode.IsSpace(runes[i+1]) {
				// Avoid very short sentences (likely abbreviations)
				if i-sentStart > 10 {
					sentences = append(sentences, sentence{startIdx: sentStart, endIdx: i + 1})
					// Skip whitespace after sentence
					for i+1 < len(runes) && unicode.IsSpace(runes[i+1]) {
						i++
					}
					sentStart = i + 1
				}
			}
		}
	}

	// Add final sentence if text doesn't end with punctuation
	if sentStart < len(runes) {
		sentences = append(sentences, sentence{startIdx: sentStart, endIdx: len(runes)})
	}

	return sentences
}

// buildSnippetFromSentences builds a snippet from a range of sentences
func buildSnippetFromSentences(runes []rune, sentences []sentence, startIdx, endIdx int) string {
	if startIdx >= endIdx || startIdx >= len(sentences) {
		return ""
	}

	start := sentences[startIdx].startIdx
	end := sentences[endIdx-1].endIdx

	return string(runes[start:end])
}

// joinSentencesUpToLimit joins sentences from startIdx until reaching runeLimit
func joinSentencesUpToLimit(runes []rune, sentences []sentence, startIdx, runeLimit int) string {
	if startIdx >= len(sentences) {
		return ""
	}

	totalRunes := 0
	endIdx := startIdx

	for i := startIdx; i < len(sentences); i++ {
		sentLen := sentences[i].endIdx - sentences[i].startIdx
		if totalRunes+sentLen > runeLimit && i > startIdx {
			break
		}
		totalRunes += sentLen
		endIdx = i + 1
	}

	if endIdx <= startIdx {
		return ""
	}

	return buildSnippetFromSentences(runes, sentences, startIdx, endIdx)
}

// extractFallbackSnippet extracts a snippet centered on targetOffset when sentence extraction fails
func extractFallbackSnippet(runes []rune, targetOffset int) string {
	// Ensure we capture the entity mention
	start := max(0, targetOffset-200)
	end := min(len(runes), targetOffset+200)

	// Adjust boundaries to avoid cutting words
	start = findSnippetStart(runes, start)
	end = findSnippetEnd(runes, end, min(end+50, len(runes)))

	// Ensure we don't trim away the entity mention
	if targetOffset < start {
		start = targetOffset
	}
	if targetOffset >= end {
		end = min(len(runes), targetOffset+50)
	}

	snippet := string(runes[start:end])
	return strings.TrimSpace(snippet)
}

// normalizeSnippet collapses whitespace and normalizes text for LLM processing
func normalizeSnippet(s string) string {
	if s == "" {
		return s
	}

	// Convert to runes for proper handling
	runes := []rune(s)
	var result []rune
	prevWasSpace := false

	for _, r := range runes {
		if unicode.IsSpace(r) {
			// Collapse consecutive whitespace (including newlines) to single space
			if !prevWasSpace && len(result) > 0 {
				result = append(result, ' ')
			}
			prevWasSpace = true
		} else {
			result = append(result, r)
			prevWasSpace = false
		}
	}

	return strings.TrimSpace(string(result))
}

// addEntityAnchorMarker adds LLM-only markers around the entity mention for better focus
// The marker helps the LLM identify which entity is being discussed in the snippet
func addEntityAnchorMarker(snippet string, entityName string, offsets []int, originalText string) string {
	if len(offsets) == 0 || snippet == "" {
		return snippet
	}

	// Use the first offset to find where the entity appears in the snippet
	snippetRunes := []rune(snippet)
	originalRunes := []rune(originalText)

	// Convert first byte offset to rune index in original text
	runeOffset := byteOffsetToRuneIndex(originalText, offsets[0])

	// Find the entity mention in the original text (approximate match)
	if runeOffset < 0 || runeOffset >= len(originalRunes) {
		return snippet
	}

	// Try to find the entity name in the snippet (case-insensitive)
	entityLower := strings.ToLower(entityName)
	snippetLower := strings.ToLower(snippet)

	idx := strings.Index(snippetLower, entityLower)
	if idx == -1 {
		// Entity name not found directly, return unchanged
		return snippet
	}

	// Calculate rune position of the entity in the snippet
	runeIdxStart := utf8.RuneCountInString(snippet[:idx])
	runeIdxEnd := runeIdxStart + utf8.RuneCountInString(entityName)

	// Build snippet with markers
	if runeIdxStart < 0 || runeIdxEnd > len(snippetRunes) {
		return snippet
	}

	result := string(snippetRunes[:runeIdxStart]) +
		"<<ENTITY:" + entityName + ">>" +
		string(snippetRunes[runeIdxStart:runeIdxEnd]) +
		"<</ENTITY>>" +
		string(snippetRunes[runeIdxEnd:])

	return result
}

func byteOffsetToRuneIndex(text string, offset int) int {
	if offset <= 0 {
		return 0
	}
	if offset > len(text) {
		offset = len(text)
	}
	return utf8.RuneCountInString(text[:offset])
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

// findSnippetEnd adjusts the end position to a natural boundary (prefers not cutting mid-word)
func findSnippetEnd(runes []rune, end, maxEnd int) int {
	if end >= len(runes) {
		return len(runes)
	}

	// Try to find whitespace within reasonable distance
	for i := end; i < maxEnd && i < len(runes); i++ {
		if unicode.IsSpace(runes[i]) {
			return i
		}
	}

	return end
}

// extractFactsFromSnippet handles fact extraction from a snippet, splitting if too large
func (w *Worker) extractFactsFromSnippet(ctx context.Context, snippet, entityName string, offsets []int, originalText, canonicalName, entityType string) ([]llm.EntityFact, error) {
	snippetRunes := []rune(snippet)

	// If snippet is within limits, process normally
	if len(snippetRunes) <= MAX_SNIPPET_RUNES {
		snippetWithMarker := addEntityAnchorMarker(snippet, entityName, offsets, originalText)
		return llm.ExtractEntityFacts(ctx, w.llmClient, canonicalName, entityType, snippetWithMarker)
	}

	// Snippet too large - split into overlapping windows
	log.Printf("Splitting large snippet (%d runes) for entity %q into multiple LLM calls", len(snippetRunes), canonicalName)

	windowSize := MAX_SNIPPET_RUNES - 100 // Leave buffer for markers
	overlapSize := 200                    // Overlap to maintain context

	var allFacts []llm.EntityFact
	factHashes := make(map[string]bool) // Deduplicate facts across windows

	for start := 0; start < len(snippetRunes); start += (windowSize - overlapSize) {
		end := min(start+windowSize, len(snippetRunes))
		windowSnippet := string(snippetRunes[start:end])

		// Add markers for this window
		windowWithMarker := addEntityAnchorMarker(windowSnippet, entityName, offsets, originalText)

		// Extract facts from this window
		windowFacts, err := llm.ExtractEntityFacts(ctx, w.llmClient, canonicalName, entityType, windowWithMarker)
		if err != nil {
			log.Printf("Warning: Failed to extract facts from window [%d:%d]: %v", start, end, err)
			continue
		}

		// Deduplicate facts using hash
		for _, fact := range windowFacts {
			hash := hashFact(fact)
			if !factHashes[hash] {
				factHashes[hash] = true
				allFacts = append(allFacts, fact)
			}
		}

		// If we've processed the entire snippet, break
		if end >= len(snippetRunes) {
			break
		}
	}

	log.Printf("Extracted %d unique facts from large snippet (%d windows)", len(allFacts), (len(snippetRunes)+windowSize-overlapSize-1)/(windowSize-overlapSize))
	return allFacts, nil
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

	// Convert map to slice
	var facts []llm.EntityFact
	for _, fact := range factMap {
		facts = append(facts, fact)
	}

	// Sort facts by confidence (descending) before selection
	selectedFacts := selectTopFacts(facts, MAX_FACTS_FOR_DISTILLATION)

	// Select snippets: prefer fact-rich snippets and early mentions
	selectedSnippets := selectFactRichSnippets(mentions, MAX_SNIPPETS_FOR_DISTILLATION)

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

	// Sort by confidence (descending), then by factType as secondary sort
	sortFactsByConfidence(facts)

	// Select top maxCount facts
	selected := make([]llm.EntityFact, 0, maxCount)
	for i := 0; i < maxCount && i < len(facts); i++ {
		selected = append(selected, facts[i])
	}
	return selected
}

// sortFactsByConfidence sorts facts in-place by confidence (descending) with factType as tiebreaker
func sortFactsByConfidence(facts []llm.EntityFact) {
	// Simple bubble sort is fine for small fact lists (typically < 100)
	n := len(facts)
	for i := 0; i < n-1; i++ {
		for j := 0; j < n-i-1; j++ {
			// Sort by confidence descending, then by factType ascending (for stability)
			if facts[j].Confidence < facts[j+1].Confidence ||
				(facts[j].Confidence == facts[j+1].Confidence && facts[j].FactType > facts[j+1].FactType) {
				facts[j], facts[j+1] = facts[j+1], facts[j]
			}
		}
	}
}

// Score each mention by fact richness
type scoredMention struct {
	mention *EntityMentionsDoc
	score   float64
}

// selectFactRichSnippets prefers snippets with high-confidence facts and early mentions
// Always includes the earliest entity introduction (first mention)
func selectFactRichSnippets(mentions []EntityMentionsDoc, maxCount int) []string {
	if len(mentions) == 0 {
		return []string{}
	}

	if len(mentions) <= maxCount {
		// Return all snippets
		snippets := make([]string, 0, len(mentions))
		for _, m := range mentions {
			if m.Snippet != "" {
				snippets = append(snippets, m.Snippet)
			}
		}
		return snippets
	}

	// Always include the first mention (earliest introduction)
	selected := make([]string, 0, maxCount)
	if mentions[0].Snippet != "" {
		selected = append(selected, mentions[0].Snippet)
	}

	// Score remaining mentions by fact richness
	scored := make([]scoredMention, 0, len(mentions)-1)
	for i := 1; i < len(mentions); i++ {
		score := calculateMentionScore(&mentions[i], i, len(mentions))
		if mentions[i].Snippet != "" {
			scored = append(scored, scoredMention{mention: &mentions[i], score: score})
		}
	}

	// Sort by score descending
	sortScoredMentions(scored)

	// Select top (maxCount - 1) from scored mentions (since we already added first)
	remaining := maxCount - len(selected)
	for i := 0; i < remaining && i < len(scored); i++ {
		selected = append(selected, scored[i].mention.Snippet)
	}

	// Deduplicate snippets (exact and near-duplicate after normalization)
	selected = deduplicateSnippets(selected)

	return selected
}

// deduplicateSnippets removes exact and near-duplicate snippets after normalization
func deduplicateSnippets(snippets []string) []string {
	if len(snippets) <= 1 {
		return snippets
	}

	seen := make(map[string]bool)
	unique := make([]string, 0, len(snippets))

	for _, snippet := range snippets {
		// Normalize for comparison (already normalized, but double-check)
		normalized := normalizeSnippet(snippet)

		// Check exact match
		if seen[normalized] {
			continue
		}

		// Check near-duplicate by comparing similarity
		isDuplicate := false
		for seenSnippet := range seen {
			if isNearDuplicate(normalized, seenSnippet) {
				isDuplicate = true
				break
			}
		}

		if !isDuplicate {
			seen[normalized] = true
			unique = append(unique, snippet) // Keep original (not normalized) for readability
		}
	}

	return unique
}

// isNearDuplicate checks if two normalized snippets are near-duplicates
// Uses simple character overlap heuristic
func isNearDuplicate(s1, s2 string) bool {
	if s1 == s2 {
		return true
	}

	// If one is a substring of the other (90%+ overlap), consider duplicate
	len1, len2 := len(s1), len(s2)
	if len1 == 0 || len2 == 0 {
		return false
	}

	shorter, longer := s1, s2
	if len1 > len2 {
		shorter, longer = s2, s1
	}

	// If shorter is 90%+ contained in longer, it's a near-duplicate
	if strings.Contains(longer, shorter) && len(shorter)*10 >= len(longer)*9 {
		return true
	}

	return false
}

// calculateMentionScore scores a mention based on fact count, confidence, and position
func calculateMentionScore(mention *EntityMentionsDoc, position, total int) float64 {
	score := 0.0

	// Factor 1: Number of facts (weight: 1.0 per fact)
	factCount := float64(len(mention.FactsExtracted))
	score += factCount * 1.0

	// Factor 2: Average confidence of facts (weight: 2.0)
	if len(mention.FactsExtracted) > 0 {
		totalConf := 0.0
		for _, fact := range mention.FactsExtracted {
			totalConf += fact.Confidence
		}
		avgConf := totalConf / float64(len(mention.FactsExtracted))
		score += avgConf * 2.0
	}

	// Factor 3: Early position bonus (weight: 1.0 for first mention, decaying)
	// First 3 mentions get bonus: 1.0, 0.7, 0.4
	if position < EARLY_MENTION_COUNT {
		earlyBonus := 1.0 - (float64(position) * 0.3)
		if earlyBonus > 0 {
			score += earlyBonus
		}
	}

	return score
}

// sortScoredMentions sorts in-place by score descending
func sortScoredMentions(scored []scoredMention) {
	n := len(scored)
	for i := 0; i < n-1; i++ {
		for j := 0; j < n-i-1; j++ {
			if scored[j].score < scored[j+1].score {
				scored[j], scored[j+1] = scored[j+1], scored[j]
			}
		}
	}
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

	// Ensure arrays are never nil (schema requires arrays, not null)
	keyFacts := description.KeyFacts
	if keyFacts == nil {
		keyFacts = []string{}
	}
	uncertainties := description.Uncertainties
	if uncertainties == nil {
		uncertainties = []string{}
	}

	update := bson.M{
		"$set": bson.M{
			"descriptionCurrent": description.Description,
			"keyFacts":           keyFacts,
			"uncertainties":      uncertainties,
			"updatedAt":          time.Now().UTC(),
		},
		"$inc": bson.M{
			"descriptionVersion": 1,
		},
	}

	_, err := db.EntitiesCollection.UpdateByID(ctx, entityID, update)
	return err
}
