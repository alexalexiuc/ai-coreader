# Entity Description Post-Processing

This feature implements post-processing of entity descriptions after a book has been fully processed.

## Overview

Instead of generating entity descriptions during chunk processing, this system:
1. Collects all entity mentions across chunks
2. Extracts structured facts from each mention
3. Distills a consolidated description using selected facts and evidence

## Architecture

### New Collections

#### `entities`
Canonical entity records per book with consolidated descriptions.
- `bookId`, `nameCanonical`, `type` (unique constraint)
- `mentionCount`, `firstSeenChunkIndex`, `lastSeenChunkIndex`
- `descriptionCurrent`, `descriptionVersion`
- `keyFacts[]`, `uncertainties[]`

#### `entity-mentions`
Individual entity mentions within chunks.
- `bookId`, `entityId`, `chunkId` (unique constraint)
- `chunkIndex`, `surfaceForm`, `offsets[]`, `snippet`
- `factsExtracted[]` (with fact type, value, confidence, evidence, hash)

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
