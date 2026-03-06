# Document processing pipeline

## Overview of pipeline stages

The repository implements a multi-stage processing pipeline that transforms an uploaded plain-text document into a structured representation suitable for assisted reading. The pipeline is executed by the Go worker and persists intermediate and final artifacts into MongoDB (and embeddings into Qdrant).

At a conceptual level, the pipeline can be described as:

1. Ingestion and durable storage (web app).
2. Job acquisition and state transitions (worker).
3. Text chunking (worker).
4. Per-chunk semantic annotation:
   - Embedding generation + vector persistence.
   - Named-entity extraction and chapter heading detection.
5. Book-level aggregation (chapter list).
6. Entity post-processing:
   - Canonical entity consolidation.
   - Mention-level snippet extraction and fact extraction.
   - Distilled entity descriptions.

Each stage is grounded in specific code paths described below.

## Stage 1: Ingestion and persistence (web app)

When a user uploads a `.txt` file, the application performs two operations:

- Persist file bytes to local disk using a generated UUID-based filename (preserving original extension), under `FILE_STORAGE_ROOT/files/` (`coreader-app/lib/files/storage.ts`).
- Insert a metadata record into the `files` collection with `status: "pending"` (and `userId` if the user is authenticated) (`coreader-app/app/uploads/actions.ts`, `coreader-app/lib/db/files.ts`, `infra/db/schemas/files.schema.json`).

The key engineering decision is that only metadata and progress live in MongoDB; the raw file payload lives on disk.

## Stage 2: Job acquisition and worker state machine

The worker treats the `files` collection as a job queue. It:

- On startup, retrieves files with `status: "pending"` or `status: "processing"` (`GetUnprocessedFiles` in `coreader-worker/db.go`) and processes them sequentially.
- Then polls every 5 seconds for `status: "pending"` files and processes up to three concurrently (`WatchFilesCollectionChanges` in `coreader-worker/db.go`).

State transitions are persisted in MongoDB:

- `pending` to `processing` at processing start (`SetFileProcessingStarted` sets `processingStartedAt` and status).
- Progress updates via `percentage` (0-100).
- `processed` on completion; `failed` on error (`coreader-worker/process_file.go`, `coreader-worker/db.go`).

Errors are tracked both as a user-facing `errorMessage` and as an append-only `rawErrorMessage` array for multiple attempts (`AppendFileError` in `coreader-worker/db.go`, schema in `infra/db/schemas/files.schema.json`).

## Stage 3: Text extraction and chunking

The worker reads the stored file using `FILE_STORAGE_ROOT` + (`storagePath`, `storageName`) from the `files` document (`coreader-worker/storage.go`). The file is streamed in byte chunks (`ReadFileInChunks`), and then transformed into logical text chunks (`ReadLogicalChunks` in `coreader-worker/chunking.go`).

Chunking behavior is controlled by constants in `coreader-worker/process_file.go`:

- Target chunk size: `CHUNK_SIZE_CHARS = 1500`.
- Byte read chunk size: `CHUNK_SIZE_BYTES = CHUNK_SIZE_CHARS * 4` (assuming up to 4 bytes per UTF-8 code point).
- A lookahead window for boundary search: `MAX_ENDING_SEARCH_CHARS = CHUNK_SIZE_CHARS / 10`.

Chunk boundaries are chosen using heuristics (`coreader-worker/chunking.go`):

1. Prefer paragraph breaks (`\n\n`).
2. Prefer sentence endings (`.`, `!`, `?` followed by whitespace).
3. Prefer comma + whitespace.
4. Otherwise, fall back to last whitespace, or force cut if buffer grows too large.

Bytes are converted to valid UTF-8 by replacing invalid sequences with the Unicode replacement character (`bytes.ToValidUTF8` via `cleanUTF8`), which reduces failure modes when persisting chunk text to MongoDB.

## Stage 4: Per-chunk persistence and semantic annotation

For each logical chunk, the worker performs multiple operations (`coreader-worker/process_file.go`).

### 4.1 Chunk document creation

Each chunk is inserted into `books-chunks` with:

- `bookId`, `index`, `startChar`, `endChar`, `text`, and `llmProcessed=false` (`infra/db/schemas/books-chunks.schema.json`).

The chunk index is 0-based and increases monotonically with processing order. The web reader uses this index as a page concept.

### 4.2 Embedding generation and storage

The worker generates an embedding for every chunk before LLM completion analysis:

- Embedding generation is done by `llm.GenerateEmbedding`, which delegates to the configured LLM client (`coreader-worker/llm/helpers.go`, `coreader-worker/llm/ollama.go`).
- The embedding is stored in Qdrant via `StoreChunkEmbedding`, using cosine distance and payload metadata (`coreader-worker/qdrant.go`).

This stage creates a chunk-level embedding index in Qdrant; the repository does not show a consumer for vector retrieval in the web app.

### 4.3 Header analysis for book metadata (first chunk only)

The first chunk is analyzed separately to extract header metadata such as `title` and `author`. The worker calls `llm.AnalyzeBookHeader` and, if the LLM response indicates a header is present, updates the `books` document (`coreader-worker/process_file.go`, prompt in `coreader-worker/llm/helpers.go`).

This enrichment is conditional: the worker updates `books.title` and `books.author` only when `AnalyzeBookHeader` returns `hasHeader=true`. The schema allows `title` and `author` to be optional (`infra/db/schemas/books.schema.json`).

### 4.4 Chunk completion analysis: entities and chapters

For each chunk, the worker calls `llm.AnalyzeChunk` to obtain:

- A list of entities (`name`, `type`).
- A list of chapter headings (strings).

The prompt is conservative and restricts chapter detection to a limited set of heading patterns; it also forbids play/poem structures ("ACT", "SCENE") (`coreader-worker/llm/helpers.go`). The LLM is expected to return JSON only, with a schema format supplied by `ChunkMetadataFormat` (`coreader-worker/llm/schemas.go`).

A key implementation detail is that entity offsets are not produced by the LLM. Instead, the worker deterministically computes offsets by finding all occurrences of the entity name in the chunk text (`correctEntityOffsets` in `coreader-worker/llm/helpers.go`). This makes entity span anchoring reproducible but also constrains matching to exact substrings.

### 4.5 Persistence of chunk annotations and progress updates

The worker updates the chunk document with the extracted entities and chapters, marking `llmProcessed=true` (`AddLLMDataToBookChunk` in `coreader-worker/db.go`). Entity references are persisted with a placeholder `entityId` (`NilObjectID`) that will be filled during post-processing.

The worker also updates the file's progress percentage based on bytes processed relative to the original file size, capping interim progress at 99% and setting 100% at the end (`coreader-worker/process_file.go`).

## Stage 5: Book-level chapter aggregation

Chapter headings returned per chunk are converted into occurrences by locating the chapter string within the chunk text and converting it into an absolute character offset (`StartOffset`) relative to the whole book (`coreader-worker/process_file.go`).

Because chapter headings can also appear in tables of contents or repeated sections, the worker deduplicates chapters by chapter name and chooses the middle occurrence among duplicates, to reduce the chance of selecting TOC-only occurrences (`deduplicateChapters` in `coreader-worker/process_file.go`). The resulting ordered list is stored as `books.chapters` (`infra/db/schemas/books.schema.json`).

## Stage 6: Entity post-processing (canonical entities, mentions, facts, descriptions)

After chunk processing completes and the book is marked processed, the worker runs a post-processing stage (`PostProcessEntityDescriptions` in `coreader-worker/entity_postprocessing.go`):

1. Load all chunks that have an `entities` array.
2. Group entity references by normalized `(name, type)` key.
3. For each entity group:
   - Upsert a canonical entity record in `entities` keyed by `(bookId, nameCanonical, type)` and update mention counts and first/last seen chunk indices.
   - Update each chunk's entity references to point to the canonical `entityId`.
   - Create an `entity-mentions` record for each chunk mention (idempotent with a unique index over `(bookId, entityId, chunkId)`).
   - For each mention, extract a snippet around the mention and call the LLM to extract structured facts (with evidence and confidence) (`coreader-worker/llm/entity_processing.go`).
   - Aggregate mention-level facts and select a bounded subset of facts/snippets, then call the LLM to distill a short description and key facts, which are stored in the canonical `entities` document (`distillEntityDescription` in `coreader-worker/entity_postprocessing.go`).

This stage turns chunk-level entity mentions into book-level canonical entities, enabling the UI to show consolidated information.

## Error handling and edge cases

The pipeline implements several defensive measures:

- On any error, the worker sets file status to `failed`, appends an error entry to history, and may delete partially created book data (`DeleteBookData` in `coreader-worker/db.go`, called from `coreader-worker/process_file.go`).
- LLM JSON parsing errors in chunk analysis trigger a split-and-retry strategy that re-analyzes two chunk halves and merges results (`coreader-worker/llm/helpers.go`).
- Invalid UTF-8 byte sequences are sanitized during chunk construction and mention snippet processing to avoid BSON/document errors (`coreader-worker/chunking.go`, additional sanitization discussed in `coreader-worker/ENTITY_POSTPROCESSING.md`).

## Repository evidence

- `coreader-app/app/uploads/actions.ts`
- `coreader-app/lib/files/storage.ts`
- `coreader-worker/db.go`
- `coreader-worker/process_file.go`
- `coreader-worker/chunking.go`
- `coreader-worker/llm/helpers.go`
- `coreader-worker/llm/schemas.go`
- `coreader-worker/entity_postprocessing.go`
- `coreader-worker/llm/entity_processing.go`
- `infra/db/schemas/*.schema.json`
- `coreader-worker/ENTITY_POSTPROCESSING.md`

## Open questions / assumptions

- The pipeline stores embeddings for every chunk, but does not implement deletion of those embeddings when a file/book is deleted in MongoDB; the long-term consistency model between MongoDB and Qdrant is therefore unclear from repository evidence.
- Header extraction only updates `title` and `author` when `hasHeader` is true; other header fields exist in the prompt but are not persisted in `books` in the observed code path.
- The chapter deduplication implementation selects the middle occurrence among duplicates; it is not clear whether chapter heading strings are normalized beyond simple list handling.
