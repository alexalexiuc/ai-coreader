# Limitations and future improvements

## Limitations visible in the current implementation

This section summarizes limitations that can be grounded in repository evidence, grouped by subsystem.

### Input formats and parsing

- The upload UX and storage pipeline are oriented around plain-text `.txt` files. There is no evidence of parsing for PDF, DOCX, EPUB, or OCR workflows (`coreader-app/app/uploads/FUNCTIONALITIES.md`, `coreader-app/app/uploads/actions.ts`, worker reads raw bytes and chunks text).
- Chunking operates on UTF-8 text and uses heuristic boundary detection. Documents with atypical punctuation, formatting, or long unbroken lines may produce poor chunk boundaries (`coreader-worker/chunking.go`).

### Processing orchestration and scalability

- The worker uses polling to discover new jobs (`WatchFilesCollectionChanges`), with a TODO suggesting migration to change streams or a message queue (`coreader-worker/db.go`). Polling introduces latency and potential duplicate work in multi-worker deployments unless coordination is added.
- Concurrency is capped at three files at a time. This is a fixed bound rather than an adaptive scheduler; it does not account for file size or LLM endpoint capacity (`coreader-worker/db.go`).
- The pipeline makes multiple LLM calls per chunk (completion + embedding) and additional calls per entity mention and per entity distillation. For long books, this can become costly and slow; the code does not include batching, caching, or a cost controller (`coreader-worker/process_file.go`, `coreader-worker/entity_postprocessing.go`).

### Semantic retrieval integration

- Embeddings are generated and stored in Qdrant, but the web app does not show a semantic retrieval feature. The reader's Search panel is lexical and page-local (`coreader-app/app/reader/[bookId]/ReaderClientPage.tsx`).
- The Qdrant integration includes an `entities` collection placeholder, but the worker does not write entity vectors and the app does not query Qdrant (`coreader-worker/qdrant.go`).

### Entity quality and representation

- Entity mention offsets rely on exact substring matches. This can miss mentions with casing differences, morphological changes, or aliases, and can spuriously match short names embedded in other words (`coreader-worker/llm/helpers.go`).
- Canonicalization is based on `(name, type)` normalization only. Ambiguous names can be merged incorrectly, and alias resolution is not implemented even though the schema supports `aliases` (`coreader-worker/entity_postprocessing.go`, `infra/db/schemas/entities.schema.json`).
- Relation extraction is not implemented as a structured graph. "Relationship" exists as a `factType` but facts are stored as free-text values without links to other entities (`infra/db/schemas/entity-mentions.schema.json`).

### UI limitations and persistence

- Highlights are not persisted to the database; they exist only in client state for the session (`coreader-app/app/reader/[bookId]/ReaderClientPage.tsx`).
- The "Coach" panel is explicitly a placeholder and not connected to a backend; thus, interactive question-answering is not a current feature (`coreader-app/app/reader/[bookId]/ReaderPanels.tsx`).
- The reader route redirects unauthenticated users to `/login`, but a corresponding route is not present in `coreader-app/app/`; authentication is otherwise implemented via modals. This indicates an incomplete routing flow (`coreader-app/app/reader/[bookId]/page.tsx`, `coreader-app/app/Header.tsx`).
- Upload and library status updates use polling rather than push-based updates (TODO for websockets), which can waste resources and reduce responsiveness (`coreader-app/app/uploads/UploadsClientPage.tsx`, `coreader-app/app/library/LibraryClientPage.tsx`).

### Data lifecycle and consistency

- Deletion and cleanup appear incomplete across the full data graph: deleting a file in the app deletes the `files` document and removes the stored file from disk, but there is no evidence of cascading deletion of the derived book/chunks/entities or Qdrant points (`coreader-app/app/uploads/actions.ts`, `coreader-app/lib/db/files.ts`, worker cleanup is only invoked on processing errors).
- The worker writes embeddings to Qdrant but does not implement Qdrant deletion during cleanup; repeated processing can therefore create stale vectors unless IDs collide (point IDs are hash-like, not guaranteed unique across different content versions).

## Future improvements aligned with the current design

The following improvements are consistent with the architecture and code patterns already present in the repository.

### 1) Add semantic retrieval to the reader (end-to-end)

- Implement a server action or route handler in `coreader-app` that:
  - Embeds user queries,
  - Queries Qdrant with filtering by `bookId`,
  - Returns ranked chunk hits with snippet context.
- Extend the reader UI to show semantic hits and navigate to the relevant page.

This improvement would turn the existing embedding write path into a complete semantic search feature and enable evaluation of retrieval quality.

### 2) Replace polling with event-driven job acquisition and UI updates

- Worker: use MongoDB change streams or an explicit queue to acquire jobs without polling (`coreader-worker/db.go` TODO).
- UI: replace periodic polling with websockets/SSE or server-driven revalidation mechanisms (TODOs in uploads/library client pages).

### 3) Improve entity normalization and relation structure

- Add alias extraction and normalization (schema already supports `aliases`).
- Add fuzzy matching or token-based matching for mention localization instead of pure substring search.
- Introduce a structured relation model (e.g., `relations` collection with `fromEntityId`, `toEntityId`, `relationType`, evidence), and update fact extraction prompts to produce resolvable references.

### 4) Improve data lifecycle management

- Define and implement cascade delete behavior:
  - When a file is deleted, delete derived `books`, `books-chunks`, `entities`, `entity-mentions`, `user-books` entries, and Qdrant points for the book.
- Add idempotent cleanup to worker retries and reprocessing.

### 5) Extend supported inputs and preprocessing

- Add parsers for common document formats (PDF/DOCX/EPUB) and normalize to text for the same downstream pipeline.
- Add language detection and language-specific tokenization/sentence segmentation where appropriate.

## Repository evidence

- `coreader-worker/db.go`
- `coreader-worker/process_file.go`
- `coreader-worker/chunking.go`
- `coreader-worker/llm/helpers.go`
- `coreader-worker/entity_postprocessing.go`
- `coreader-worker/qdrant.go`
- `coreader-app/app/reader/[bookId]/ReaderClientPage.tsx`
- `coreader-app/app/reader/[bookId]/ReaderPanels.tsx`
- `coreader-app/app/uploads/UploadsClientPage.tsx`
- `coreader-app/app/library/LibraryClientPage.tsx`
- `coreader-app/app/uploads/actions.ts`
- `coreader-app/lib/db/files.ts`
- `infra/db/schemas/entities.schema.json`
- `infra/db/schemas/entity-mentions.schema.json`

## Open questions / assumptions

- The repository does not clearly specify a delete-book workflow. It is assumed that data lifecycle management is incomplete rather than intentionally omitted.
- It is unclear whether semantic search is planned to be book-scoped, user-scoped, or global; this impacts filtering and evaluation design.
- Some improvements (e.g., relation graph) require schema evolution; the repo already has a migration system, but the desired target schema is not specified.
