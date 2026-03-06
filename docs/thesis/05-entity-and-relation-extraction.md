# Entity and relation extraction

## Entity extraction strategy

The repository implements entity extraction as a two-phase approach:

1. Chunk-level entity detection during ingestion: the worker calls an LLM to produce a list of entities per chunk (name + coarse type), then derives mention offsets deterministically by string matching (`coreader-worker/llm/helpers.go`).
2. Book-level consolidation after all chunks are processed: entities are grouped and canonicalized into a dedicated collection; mention-level records are created and enriched with extracted facts and distilled descriptions (`coreader-worker/entity_postprocessing.go`).

This design separates per-chunk annotation from cross-chunk aggregation performed after ingestion.

## Chunk-level extraction: prompt, types, and offsets

### Prompt and output schema

Chunk analysis is performed by `AnalyzeChunk`, which sends a prompt created by `buildChunkAnalysisPrompt` to the LLM. The prompt is designed to:

- Extract named entities in a conservative manner (only proper nouns or explicitly named concepts).
- Classify each entity into one of the allowed types: `character`, `place`, `organization`, `artifact`, `event`, `work`, `other`.
- Detect only book-style chapter headings, using a strict inclusion/exclusion list (e.g., allow "Chapter 1", "Prologue"; disallow "ACT"/"SCENE").

The LLM is expected to respond with JSON only, using a schema format (`ChunkMetadataFormat`) that disallows additional properties (`coreader-worker/llm/schemas.go`, used in `coreader-worker/llm/helpers.go`).

### Deterministic mention offsets

Although chunk entities are extracted by an LLM, the system does not ask the LLM to provide character offsets. Instead:

- The worker computes offsets by searching the chunk text for all occurrences of each entity name (`correctEntityOffsets` calls `findAllOccurrences` in `coreader-worker/llm/helpers.go`).
- The computed offsets are stored in `books-chunks.entities[].startOffsets` as "all occurrences relative to chunk.text" (`infra/db/schemas/books-chunks.schema.json`).

This approach increases reproducibility and reduces dependence on the model's ability to count characters, but it introduces limitations: it will miss mentions that are not exact substring matches (e.g., casing differences, inflections, aliases, pronouns), and it may produce false matches for short names or substrings.

## Book-level consolidation: canonical entities and mention records

### Canonicalization and persistence model

After chunk processing, the worker loads all chunks containing entities and groups entity references by a normalized key `(lower(name) + "|" + lower(type))` (`normalizeEntityKey` in `coreader-worker/entity_postprocessing.go`).

For each group, the worker:

- Upserts a canonical entity in the `entities` collection keyed by `(bookId, nameCanonical, type)` and updates:
  - `mentionCount`, `firstSeenChunkIndex`, `lastSeenChunkIndex`.
  - `descriptionVersion` (incremented when new description is written).
- Updates every chunk's entity reference to include the canonical `entityId` (`UpdateChunkEntityID` in `coreader-worker/db.go`).

The DB schema for canonical entities (`infra/db/schemas/entities.schema.json`) supports:

- `nameCanonical`, `type`, `aliases` (present but not populated by the observed code),
- `descriptionCurrent`, `keyFacts`, `uncertainties`.

### Mention-level records

For each chunk mention of an entity, the worker creates an `entity-mentions` document containing:

- References: `bookId`, `entityId`, `chunkId`, `chunkIndex`.
- Surface form and offsets: `surfaceForm`, `offsets[]`.
- A context snippet around the mention (`snippet`).
- Extracted facts (`factsExtracted[]`) with `factType`, `value`, `confidence`, `evidence`, and a deduplication `hash`.

Uniqueness and lookup performance are supported by indexes applied via migration `infra/db/migrations/20260109000000-add-entity-postprocessing-collections.js`.

## Fact extraction and relation-like information

### Fact extraction

Facts are extracted per mention snippet using an LLM call (`ExtractEntityFacts` in `coreader-worker/llm/entity_processing.go`). The prompt:

- Requests only facts supported by the snippet, each with a short evidence quote.
- Produces a JSON array of facts with a bounded set of `factType` values: `role`, `trait`, `appearance`, `relationship`, `event`, `location`, `other`.
- Uses low temperature to reduce variability and encourages conservative extraction.

For large snippets, the worker splits the snippet into overlapping windows and deduplicates facts across windows using a deterministic hash built from `(factType|evidence|value)` (`extractFactsFromSnippet` and `hashFact` in `coreader-worker/entity_postprocessing.go`).

### Distilled entity description

After mention-level fact extraction, the worker aggregates facts across mentions, selects top facts by confidence (capped at 50), selects up to 10 fact-rich snippets (favoring early mentions and high-confidence facts), and calls the LLM to distill:

- A short description (2-6 sentences).
- 5-12 key facts.
- A list of uncertainties/contradictions.

This distilled result is stored on the canonical entity record (`UpdateEntityDescription` in `coreader-worker/entity_postprocessing.go`).

### What "relation extraction" means in the current system

The repository does not define a dedicated relations collection (e.g., entity-to-entity edges). Instead, relation-like information appears in two places:

- Chunk-level co-occurrence is implicit: entities that appear in the same chunk can be interpreted as a weak contextual relation, but it is not persisted as a graph.
- Mention-level facts allow `factType: "relationship"`, but the `value` field is a string and does not necessarily reference other canonical entities in a machine-resolvable way (`infra/db/schemas/entity-mentions.schema.json`).

Therefore, in the current implementation, relation extraction is best described as extraction of relation-like statements about an entity, stored as unnormalized textual facts, rather than structured relation inference between entities.

## Limitations and expected error modes

Based on the implementation, the following limitations are expected:

- Exact-match mention localization: offsets are computed from exact substring occurrences; aliases and morphological variations are not resolved.
- No cross-entity linking in relationship facts: even if the LLM outputs "X is Y's brother", the system stores it as text rather than a link to another entity ID.
- Canonicalization is name+type only: entities with the same name but different referents in a book (or different capitalization/alias forms) may be merged or split incorrectly.
- Chunk-local entity detection: the chunk-level prompt explicitly states the model has no global context; this can lead to inconsistent extraction across chunks (different naming, missed entities).

## Repository evidence

- `coreader-worker/llm/helpers.go`
- `coreader-worker/llm/schemas.go`
- `coreader-worker/process_file.go`
- `coreader-worker/entity_postprocessing.go`
- `coreader-worker/llm/entity_processing.go`
- `infra/db/schemas/books-chunks.schema.json`
- `infra/db/schemas/entities.schema.json`
- `infra/db/schemas/entity-mentions.schema.json`
- `infra/db/migrations/20260109000000-add-entity-postprocessing-collections.js`
- `coreader-worker/ENTITY_POSTPROCESSING.md`

## Open questions / assumptions

- The schemas include `aliases` on canonical entities, but the inspected code does not populate aliases. It is unclear whether alias extraction is planned or implemented elsewhere.
- The UI surfaces entity descriptions at read time by querying the `entities` collection; there is no evidence that mention-level facts are currently presented to the user.
- Some of the relation-like facts may implicitly name other entities, but without normalization the extent to which they can support graph-based features is uncertain.
