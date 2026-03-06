# Evaluation ideas

This document lists evaluation directions that are compatible with the implementation present in the repository. Where an evaluation depends on missing functionality (e.g., vector retrieval in the web app), it is explicitly marked as contingent.

## Data available for evaluation (as implemented)

The repository persists intermediate artifacts that can be used as evaluation inputs and outputs:

- Chunk text and chunk-level annotations in `books-chunks` (`infra/db/schemas/books-chunks.schema.json`).
- Canonical entities in `entities` and mention-level evidence in `entity-mentions` (`infra/db/schemas/entities.schema.json`, `infra/db/schemas/entity-mentions.schema.json`).
- Processing telemetry in `files` (status, timestamps, percentage, error history) (`infra/db/schemas/files.schema.json`).
- Chunk embeddings in Qdrant `book_chunks` (write path only in the inspected code) (`coreader-worker/qdrant.go`).

## 1) Entity extraction quality (chunk-level)

### Objective

Measure how accurately the chunk-level LLM step extracts named entities and assigns coarse types (`character`, `place`, etc.) as implemented by `AnalyzeChunk` (`coreader-worker/llm/helpers.go`).

### Method

- Build a small gold dataset of chunks sampled from uploaded texts:
  - Use the chunking algorithm and constants used in production (`coreader-worker/chunking.go`, `coreader-worker/process_file.go`) to ensure the same boundaries.
- For each chunk, manually annotate:
  - A set of entity names present in the chunk.
  - Optional entity types aligned to the allowed enum.
- Run the worker chunk analysis step and compare:
  - Precision/recall/F1 for entity presence.
  - Accuracy or macro-F1 for entity type classification (only for true positives).

### Repository constraints and notes

- Offsets are computed by exact substring search after LLM extraction, so evaluation should focus on the entity list quality rather than mention span detection (unless span evaluation is explicitly desired).
- Since the prompt is conservative, recall may be intentionally lower; this should be reflected in the evaluation narrative.

## 2) Mention localization and highlight correctness (UI-facing)

### Objective

Assess whether entity highlights in the reader correctly correspond to entity mentions in displayed paragraphs.

### Method

- For a set of pages (chunks), inspect:
  - `books-chunks.entities[].startOffsets` in MongoDB.
  - The rendered UI segmentation into paragraphs (`coreader-app/app/reader/[bookId]/chunkUtils.ts`).
- Define metrics:
  - Highlight precision: proportion of highlighted spans that are true mentions.
  - Highlight coverage: proportion of true mentions that are highlighted (expected to be lower if entities appear in variants/aliases).
- Include qualitative error analysis for:
  - Offsets in paragraphs affected by normalization of newlines and whitespace.
  - False matches for short names.

This evaluation ties directly to the end-user assisted reading experience.

## 3) Fact extraction quality (mention-level)

### Objective

Evaluate the correctness of structured facts extracted from mention snippets in `entity-mentions.factsExtracted[]` (`infra/db/schemas/entity-mentions.schema.json`, implemented in `coreader-worker/entity_postprocessing.go` and `coreader-worker/llm/entity_processing.go`).

### Method

- Sample a set of `entity-mentions` documents with non-empty `factsExtracted`.
- For each fact, ask human evaluators to label:
  - Supported by snippet (yes/no).
  - FactType appropriateness (yes/no).
  - Evidence quote adequacy (yes/no).
- Report:
  - Support precision (primary).
  - Distribution of fact types and confidence scores.

### Evidence alignment

The system explicitly requests evidence quotes and confidence scores, so fact support evaluation can use these fields directly. Because facts are stored per mention, they also support intra-entity analysis (do facts converge or contradict across mentions?).

## 4) Distilled entity descriptions: usefulness and faithfulness

### Objective

Evaluate the quality of `entities.descriptionCurrent`, `keyFacts[]`, and `uncertainties[]` fields, produced by LLM distillation (`coreader-worker/entity_postprocessing.go`).

### Method

- For a sample of canonical entities:
  - Provide evaluators with the selected snippets and extracted facts (available via `entity-mentions` for that entity).
  - Evaluate the distilled description on:
    - Faithfulness: does it contradict evidence?
    - Coverage: does it capture the most salient facts?
    - Usefulness: does it help a reader recall context?
  - Use Likert scales and qualitative comments.

This is aligned with the system's goal of assisted reading rather than purely information extraction.

## 5) Pipeline performance: throughput, latency, and cost proxies

### Objective

Characterize processing cost and scalability:

- Time per file, time per chunk.
- Number of LLM calls per file (completion + embedding per chunk; additional calls per entity mention and per entity distillation).
- Failure rates and retry behavior.

### Method

- Instrument or parse logs during processing runs:
  - Worker logs include progress updates and chunk/entity counts (`coreader-worker/process_file.go`).
  - LLM request logging hooks exist (`coreader-worker/llm/logger.go`, `coreader-worker/llm/context.go`), though their output strategy should be verified empirically.
- Report:
  - Processing time distributions over file sizes.
  - Correlation between number of chunks/entities and processing time.

Even without direct monetary cost accounting, call counts and processing time are useful proxies for cost and feasibility.

## 6) Semantic retrieval evaluation (contingent on implementing retrieval)

### Objective

If a retrieval feature is added that queries Qdrant, evaluate semantic search relevance using standard IR metrics.

### Method

- Implement a minimal query path:
  - Query embedding generation using the same model as chunk embeddings (`coreader-worker/llm/ollama.go` logic, or a shared embedding utility).
  - Qdrant nearest-neighbor search in `book_chunks` filtered by `bookId` (`coreader-worker/qdrant.go` defines the collection and payload fields).
- Build a query set:
  - User questions or information needs derived from the book.
  - For each query, label relevant chunks (or passages).
- Evaluate:
  - nDCG@k, Recall@k, MRR.

This evaluation is compatible with the current data model because embeddings are already stored with metadata to map hits to chunks.

## 7) Usability evaluation of assisted reading

### Objective

Assess whether entity highlighting and summaries improve reading comprehension or reduce cognitive load.

### Method

- A within-subject study comparing:
  - Baseline reading (no entity highlighting/popup descriptions).
  - Assisted reading (current reader with entity popups).
- Tasks:
  - Answer comprehension questions requiring entity tracking (e.g., "Who performed action X?", "Where did event Y occur?").
  - Navigation tasks using chapters and entity panels.
- Metrics:
  - Task completion time, accuracy, and subjective workload (e.g., NASA-TLX).

The current UI supports entity popups and chapter navigation directly (`coreader-app/app/reader/[bookId]/*`), making this evaluation feasible without new features.

## Repository evidence

- `coreader-worker/chunking.go`
- `coreader-worker/process_file.go`
- `coreader-worker/llm/helpers.go`
- `coreader-worker/entity_postprocessing.go`
- `coreader-worker/llm/entity_processing.go`
- `infra/db/schemas/entities.schema.json`
- `infra/db/schemas/entity-mentions.schema.json`
- `coreader-worker/qdrant.go`
- `coreader-app/app/reader/[bookId]/ReaderClientPage.tsx`
- `coreader-app/app/reader/[bookId]/ReaderTextView.tsx`
- `coreader-app/app/reader/[bookId]/EntityPopup.tsx`
- `coreader-app/app/reader/[bookId]/chunkUtils.ts`

## Open questions / assumptions

- LLM-driven components introduce nondeterminism. For rigorous evaluation, the experimental setup may need fixed models, fixed prompts, and possibly caching of LLM outputs; the repository does not include a built-in evaluation harness.
- The current search UI is lexical and page-local. Semantic search evaluation requires additional implementation to query Qdrant and return ranked results.
- Ground truth construction (entities, facts, relevance judgments) is labor-intensive; the repository provides schemas and storage for artifacts but not annotation tooling.
