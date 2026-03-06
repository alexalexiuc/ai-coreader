# System overview

## Problem statement and motivation

This repository contains an implementation of an assisted-reading system for long-form text documents (currently plain-text book uploads). The system performs automated analysis over the text to identify named entities, aggregates entity information across the document, and presents a reader interface that highlights entity mentions and displays consolidated entity descriptions.

The implementation separates interactive user workflows (upload, browse library, read) from long-running document processing. Interactive workflows are implemented in a Next.js application (`coreader-app/`). Processing is implemented in a Go worker (`coreader-worker/`) that performs chunking, LLM-based extraction, and persistence, including a vector embedding write path into Qdrant.

## Intended users and usage context

The user-facing component is an authenticated web interface. The authentication model is implemented in the repository (Mongo-backed sessions and a cookie named `session_token`), suggesting the system targets individual users with private libraries rather than anonymous processing.

The primary supported workflow is: a user uploads a text file, waits for background processing, then reads the resulting book in a UI that provides entity highlights, a table of contents derived from extracted chapter headings, and a page-local search panel. The codebase also includes UI surfaces labeled "Shop" and "Coach"; these are explicitly disabled or marked as placeholders and should be treated as non-functional in the current state.

## Scope and terminology (as implemented)

- Document: a user-uploaded file represented by a `files` document in MongoDB and a binary file on disk under `FILE_STORAGE_ROOT`.
- Book: the processed artifact represented by a `books` document; it references the source file via `fileId`.
- Chunk: a segment of the document stored in `books-chunks` with a 0-based `index`. The reader uses chunk index as a "page" concept.
- Canonical entity: a record in `entities` representing an entity aggregated across chunks for a single book.
- Entity mention: a record in `entity-mentions` representing an entity occurrence in a specific chunk, including a snippet and extracted facts.

## Inputs

The observable primary input is a text file uploaded by the user:

- Upload workflow is implemented via a server action that accepts a `File` object from `FormData`, stores it on local disk, and inserts metadata into MongoDB with initial `status: "pending"` (`coreader-app/app/uploads/actions.ts`, `coreader-app/lib/files/storage.ts`, `coreader-app/lib/db/files.ts`).
- The supported format is `.txt` in the UI documentation for the Uploads page (`coreader-app/app/uploads/FUNCTIONALITIES.md`). The worker-side pipeline reads the stored file bytes from `FILE_STORAGE_ROOT` and performs chunking on UTF-8 text (`coreader-worker/storage.go`, `coreader-worker/chunking.go`).

Configuration inputs (infrastructure and runtime) are provided through environment variables and Docker Compose configuration, including Mongo connection (`MONGODB_URI`, `MONGODB_DB_NAME`), storage root (`FILE_STORAGE_ROOT`), LLM endpoint (`LLM_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_EMBEDDING_MODEL`), and Qdrant connectivity (`QDRANT_HOST`, `QDRANT_PORT`, `QDRANT_VECTOR_DIMENSION`) as seen in `infra/docker-compose.yaml` and worker code.

## Outputs

The system produces persisted artifacts that can be grouped by storage layer:

- Local disk: the uploaded file bytes under `FILE_STORAGE_ROOT` (written by `coreader-app/lib/files/storage.ts`).
- MongoDB: `files`, `books`, `books-chunks`, `entities`, `entity-mentions`, `user-books`, `users`, and `sessions` (schemas in `infra/db/schemas/*.schema.json`).
- Qdrant: per-chunk embeddings stored in a collection named `book_chunks` with payload fields that reference `bookId` and `chunkId` (`coreader-worker/qdrant.go`).

## Implemented semantic capabilities

The semantic layer in this repository is implemented in two complementary ways:

- LLM-based extraction of structured metadata from text chunks: named entities and chapter headings, persisted in `books-chunks` and aggregated into `books.chapters` (`coreader-worker/llm/helpers.go`, `coreader-worker/process_file.go`).
- Embedding generation per chunk and persistence to a vector database (Qdrant) during ingestion (`coreader-worker/llm/ollama.go`, `coreader-worker/qdrant.go`, called from `coreader-worker/process_file.go`).

Assisted reading features implemented in the UI include:

- Entity highlighting and an entity details popup driven by canonical entity records in MongoDB (`coreader-app/app/reader/[bookId]/EntityPopup.tsx`, `coreader-app/lib/db/entities.ts`).
- Chapter navigation based on worker-produced `books.chapters` (`coreader-app/app/reader/[bookId]/page.tsx`, `coreader-worker/process_file.go`).
- Page-local lexical search over the rendered blocks in the reader client component (`coreader-app/app/reader/[bookId]/ReaderClientPage.tsx`).

## End-to-end processing overview

An end-to-end run proceeds as follows (a more detailed breakdown is provided in `docs/thesis/03-document-processing-pipeline.md`):

1. The user uploads a `.txt` file from the `/uploads` page. The web app writes the file to `FILE_STORAGE_ROOT/files/<uuid>.<ext>` and inserts a `files` document with `status: "pending"` and a `userId` reference (`coreader-app/app/uploads/actions.ts`, `coreader-app/lib/files/storage.ts`, `infra/db/schemas/files.schema.json`).
2. The Go worker polls MongoDB for pending files and starts processing. It sets file status to `"processing"` and records timestamps (`coreader-worker/db.go`).
3. The worker reads the file from disk, converts bytes into UTF-8-safe text, and splits it into logical chunks with heuristic boundary detection, targeting roughly 1500 characters (`coreader-worker/storage.go`, `coreader-worker/chunking.go`, constants in `coreader-worker/process_file.go`).
4. For each chunk, the worker:
   - Inserts a `books-chunks` document containing raw chunk text.
   - Generates an embedding for the chunk and stores it in Qdrant (`coreader-worker/process_file.go`, `coreader-worker/llm/ollama.go`, `coreader-worker/qdrant.go`).
   - Calls the LLM to extract entities and chapter headings; offsets are computed deterministically by searching for entity names in the chunk (`coreader-worker/llm/helpers.go`).
   - Updates the chunk document with the extracted entity references (temporarily with `entityId = NilObjectID`) and chapter candidates, and updates the file's progress percentage (`coreader-worker/process_file.go`).
5. After all chunks are processed, the worker deduplicates chapter occurrences and stores an ordered chapter list on the `books` document, marks the book `processed=true`, and runs entity post-processing to create canonical entities and mention-level records with facts and consolidated descriptions (`coreader-worker/process_file.go`, `coreader-worker/entity_postprocessing.go`).
6. The user reads the book in `/reader/[bookId]`, where access is validated via a `user-books` ownership link and reading progress is recorded (`coreader-app/app/reader/[bookId]/page.tsx`, `coreader-app/lib/db/user-books.ts`).

## Repository evidence

- `coreader-app/app/uploads/actions.ts`
- `coreader-app/lib/files/storage.ts`
- `coreader-app/app/reader/[bookId]/page.tsx`
- `coreader-app/app/reader/[bookId]/ReaderClientPage.tsx`
- `coreader-worker/process_file.go`
- `coreader-worker/chunking.go`
- `coreader-worker/llm/helpers.go`
- `coreader-worker/entity_postprocessing.go`
- `coreader-worker/qdrant.go`
- `infra/db/schemas/*.schema.json`
- `infra/docker-compose.yaml`

## Open questions / assumptions

- The reader code redirects unauthenticated users to `/login`, but the repository does not include an obvious `/login` route; authentication UI appears to be implemented via modals. This indicates a route mismatch or incomplete routing.
- The worker stores embeddings in Qdrant, but the repository does not show a corresponding retrieval API or UI feature that queries Qdrant for semantic search. The embedding index should therefore be treated as a stored intermediate artifact rather than a user-visible feature.
- Only `.txt` upload support is explicitly documented for the UI; if additional formats are supported, they are not evident from the files inspected.
- Entity relations are not stored as a dedicated graph structure. A `factType` named `relationship` exists for mention-level facts, but it is stored as free-text rather than a normalized entity-to-entity edge.
