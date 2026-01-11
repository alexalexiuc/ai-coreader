# Entity Description Post-Processing

This feature implements post-processing of entity descriptions after a book has been fully processed.

## Overview

Instead of generating entity descriptions during chunk processing, this system:
1. Collects all entity mentions across chunks
2. Extracts structured facts from each mention
3. Distills a consolidated description using selected facts and evidence

## Architecture

### Collections

#### `entities` (New - Canonical Source)
Canonical entity records per book with consolidated descriptions.
- `bookId`, `nameCanonical`, `type` (unique constraint)
- `mentionCount`, `firstSeenChunkIndex`, `lastSeenChunkIndex`
- `descriptionCurrent`, `descriptionVersion`
- `keyFacts[]`, `uncertainties[]`

**Purpose:** This is the authoritative source for entity information after post-processing.

#### `entity-mentions` (New)
Individual entity mentions within chunks.
- `bookId`, `entityId`, `chunkId` (unique constraint)
- `chunkIndex`, `surfaceForm`, `offsets[]`, `snippet`
- `factsExtracted[]` (with fact type, value, confidence, evidence, hash)

**Purpose:** Tracks each occurrence of an entity with extracted facts from context.

#### `entity-descriptions` (Legacy - Deprecated)
⚠️ **Status:** This collection is now redundant and should be considered deprecated.

**Current Usage:** 
- Created during chunk processing in `processFile.go` to track which entities have been seen
- Used as temporary storage during file processing
- Should eventually be replaced by using `entities` directly

**Migration Path:**
1. Refactor `processFile.go` to use `entities` collection instead
2. Update frontend to query `entities` instead of `entity-descriptions`
3. Remove `entity-descriptions` collection and related code

### Key Components

#### `entity_postprocessing.go`
Main post-processing logic:
- `PostProcessEntityDescriptions()` - Entry point called after book processing
- `processEntityGroup()` - Processes all mentions of a single entity
- `distillEntityDescription()` - Creates consolidated description
- Helper functions for fact/snippet selection and deduplication

#### `llm/entity_processing.go`
LLM integration for entity analysis:
- `ExtractEntityFacts()` - Extracts structured facts from mention snippets
- `DistillEntityDescription()` - Creates consolidated description from facts

### LLM Prompts

#### Fact Extraction (Prompt A)
**Input:** Entity name, type, and text snippet (±250 chars around mention)
**Output:** JSON array of facts with:
- `factType`: role, trait, appearance, relationship, event, location, other
- `value`: The fact value
- `confidence`: 0-1 score
- `evidence`: Short quote from snippet (≤20 words)

**Rules:**
- Only facts supported by snippet
- Atomic facts (one per object)
- Empty array if no useful information

#### Description Distillation (Prompt B)
**Input:** Entity name, type, current description (if any), selected facts[], snippets[]
**Output:** JSON object with:
- `description`: 2-6 sentences, grounded in evidence
- `keyFacts`: 5-12 bullet-like strings
- `uncertainties`: Things unclear or contradictory

**Rules:**
- Must not contradict facts
- If facts are weak, keep description minimal
- No invented information

### Constraints

**Bounded LLM Inputs:**
- Per-mention fact extraction: ±250 chars snippet only
- Distillation: Max 50 facts, 10 snippets

**Smart Selection:**
- Prioritizes early mentions (first 2-5)
- Includes high-confidence facts
- Deduplicates facts by hash

**Idempotency:**
- Unique indexes prevent duplicate mentions
- Safe to re-run post-processing
- Incremental description versioning

## Integration

Post-processing is automatically triggered in `processFile.go` after:
1. All chunks are processed
2. Book is marked as `processed=true`
3. Before file status is set to "processed"

Non-fatal errors in post-processing are logged but don't fail the overall job.

## Testing

Unit tests in `entity_postprocessing_test.go` cover:
- Entity key normalization
- Snippet extraction
- Fact hashing and deduplication
- Top fact/snippet selection
- Helper functions (min, max)

Run tests:
```bash
cd coreader-worker
FILE_STORAGE_ROOT=/tmp go test -v
```

## Performance Considerations

- Processes entities sequentially to avoid memory issues
- Batches mention processing (logs every 10 mentions)
- Uses indexes for efficient queries:
  - `(bookId, nameCanonical, type)` on entities
  - `(bookId, entityId, chunkId)` on entity-mentions
  - `(entityId, chunkIndex)` on entity-mentions

## Future Enhancements

Potential improvements:
- Parallel entity processing
- More sophisticated fact ranking algorithms
- Incremental updates when new chunks are added
- Cross-book entity disambiguation
- Alias resolution and tracking

## Recent Fixes

### UTF-8 Validation (PR Comment #2679355899)
**Issue:** Invalid UTF-8 sequences in text caused MongoDB BSON document errors when storing snippets.

**Solution:** Added `sanitizeUTF8()` function that uses `strings.ToValidUTF8()` to replace invalid UTF-8 byte sequences with the Unicode replacement character (�).

**Implementation:**
```go
func sanitizeUTF8(s string) string {
    if !utf8.ValidString(s) {
        return strings.ToValidUTF8(s, "�")
    }
    return s
}
```

All snippets are now sanitized before storage in the `entity-mentions` collection.

### Multi-Mention Snippet Extraction (PR Comment #2679357043)
**Issue:** When an entity appeared multiple times in a single chunk, only the first mention was captured in the snippet, losing valuable context.

**Solution:** Updated `extractSnippet()` to:
1. Find the span of all mentions (min to max offset)
2. Include context around the entire span when mentions are close together
3. Fall back to first mention only if span exceeds 3x context chars (to avoid overly large snippets)

**Example:**
- Entity mentioned at offsets [100, 150, 200] in a chunk
- Old behavior: Extract snippet around offset 100 only
- New behavior: Extract snippet from (100-250) to (200+250), capturing all three mentions

This provides richer context for fact extraction while keeping snippet size bounded.

### Collection Redundancy (PR Comment #2679351257)
**Issue:** Both `entity-descriptions` (legacy) and `entities` (new) collections exist, creating redundancy.

**Current State:**
- `entity-descriptions`: Used during chunk processing for temporary tracking
- `entities`: Canonical source created during post-processing

**Recommendation:** Migrate to use `entities` exclusively:
1. Refactor `processFile.go` to use `entities` collection during chunk processing
2. Update frontend to query `entities` instead of `entity-descriptions`
3. Remove `entity-descriptions` collection in a future PR

**Note:** This is marked for future work as it requires broader refactoring beyond the scope of the post-processing feature.
