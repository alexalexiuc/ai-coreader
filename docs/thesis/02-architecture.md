# Architecture

## Architecture summary (as implemented)

The codebase implements a two-process architecture: a Next.js web application (`coreader-app/`) and a Go worker (`coreader-worker/`). The web application handles interactive workflows (authentication, uploads, reading UI). The worker performs asynchronous processing over uploaded files, including LLM-based extraction and embedding generation, and writes results to persistent stores.

The repository includes infrastructure for local deployment via Docker Compose, with two main operational modes: "host dev" (MongoDB/Ollama/Qdrant in containers, app/worker on the host) and a fully dockerized "stack" profile that runs app and worker in containers (`infra/docker-compose.yaml`, `scripts/dev.*`, `scripts/up-docker.*`).

## Components and boundaries

### 1) Next.js web application (`coreader-app/`)

The web application is responsible for:

- UI and routes (`coreader-app/app/*`), including `/uploads`, `/library`, `/reader/[bookId]`, and `/account`.
- Authentication and session management using MongoDB collections `users` and `sessions` and an HTTP-only cookie (`coreader-app/lib/auth/*`, `coreader-app/app/auth/actions.ts`).
- Writing uploaded file bytes to local storage and inserting file metadata into MongoDB (`coreader-app/lib/files/storage.ts`, `coreader-app/lib/db/files.ts`).
- Enforcing authorization checks on file download and book reading by comparing user identity with stored ownership fields (`coreader-app/app/api/files/[id]/download/route.ts`, `coreader-app/app/reader/[bookId]/page.tsx`, `coreader-app/lib/db/user-books.ts`).

The application does not expose a long-running processing API. Instead, it persists upload metadata in MongoDB and relies on the worker to detect and process pending files.

### 2) Go processing worker (`coreader-worker/`)

The worker is responsible for:

- Finding and processing pending file jobs from MongoDB (`coreader-worker/main.go`, polling loop in `coreader-worker/db.go`).
- Converting raw file bytes into text and splitting text into bounded chunks with heuristic boundary detection (`coreader-worker/storage.go`, `coreader-worker/chunking.go`).
- Calling an LLM endpoint to:
  - Extract named entities and chapter headings per chunk (completion endpoint).
  - Generate embeddings per chunk (embedding endpoint).
  - Extract mention-level facts and distill entity descriptions in a post-processing phase (`coreader-worker/llm/*`, `coreader-worker/entity_postprocessing.go`).
- Persisting the resulting artifacts in MongoDB collections and Qdrant collections (`coreader-worker/db.go`, `coreader-worker/qdrant.go`).

The worker is designed as a batch processor with retry capability: processing errors update the file status and record error history, and partial results can be cleaned up when failures occur (`coreader-worker/process_file.go`).

### 3) MongoDB (persistence and validation)

MongoDB is used as the primary transactional store for:

- Upload metadata and processing status (`files`).
- Processed book metadata (`books`) and per-chunk text/annotations (`books-chunks`).
- Authentication (`users`, `sessions`) and ownership/progress (`user-books`).
- Semantic annotations (`entities`, `entity-mentions`).

The schema is enforced via MongoDB collection validators generated from JSON Schemas. A migration (`infra/db/migrations/20251221235500-init.js`) applies validators with `validationLevel: "strict"` and `validationAction: "error"`, which makes the database reject documents that do not conform to the schema.

### 4) Local filesystem storage (`FILE_STORAGE_ROOT`)

Uploaded file bytes are stored on disk rather than inside MongoDB (`coreader-app/lib/files/storage.ts`). The worker reads from the same storage root using fields from the `files` document (`storagePath`, `storageName`) (`coreader-worker/storage.go`).

This design decouples large binary storage from document metadata and avoids MongoDB document size constraints for file payloads, but it also introduces an operational requirement: the app and worker must share the same storage root (via host filesystem in dev or via Docker volume mounts in the dockerized stack).

### 5) LLM endpoint (Ollama) and provider abstraction

The default LLM provider is Ollama, started via Docker Compose (`infra/docker-compose.yaml`). The container entrypoint script pulls a generation model and an embedding model on startup (`infra/ollama-entrypoint.sh`). The worker selects an LLM client via the `AI_CLIENT` environment variable (`coreader-worker/llm/aiProvider.go`).

### 6) Qdrant (vector database)

Qdrant stores vector embeddings for book chunks. The worker creates or reuses collections and writes points with cosine distance configuration (`coreader-worker/qdrant.go`). Payload fields (`bookId`, `chunkId`, `chunkIndex`) allow mapping from vector hits back to MongoDB chunk records, but the repository does not show a corresponding query path in the web application.

## Main interaction flows

### Interactive request path (web app)

Authenticated UI actions occur within the Next.js server environment:

- File upload: server action writes bytes to disk and inserts a `files` document with `status: "pending"`.
- File download: API route reads bytes from disk after verifying ownership.
- Library and reader pages: server components fetch MongoDB documents and render UI; the reader also updates reading progress (`user-books`).

The app uses periodic polling in client components to refresh upload status and library updates while processing is in progress (`coreader-app/app/uploads/UploadsClientPage.tsx`, `coreader-app/app/library/LibraryClientPage.tsx`).

### Asynchronous processing path (worker)

Worker starts, loads configuration from environment, connects to MongoDB and Qdrant, then:

- Processes existing pending/processing files on startup (`GetUnprocessedFiles`).
- Enters a loop that polls MongoDB every 5 seconds for new pending files and processes up to three concurrently (`coreader-worker/db.go`).

This is a pull-based job acquisition model. The `files` collection acts as the job queue, with the `status` field as the primary state machine.

## Design rationale and implications (evidence-based)

The following implications follow from the implementation choices:

- LLM calls are executed only in the worker (chunk analysis, fact extraction, and embedding generation), which avoids embedding/LLM latency in web requests (`coreader-worker/process_file.go`, `coreader-worker/entity_postprocessing.go`).
- Processing state is stored in MongoDB (`files.status`, progress percentage, timestamps), enabling the UI to show progress via polling without direct worker-to-app communication (`infra/db/schemas/files.schema.json`, `coreader-app/app/uploads/UploadsClientPage.tsx`).
- Intermediate artifacts are persisted as first-class entities (chunks, canonical entities, mention records), enabling UI features such as entity popups to read directly from MongoDB (`infra/db/schemas/books-chunks.schema.json`, `infra/db/schemas/entities.schema.json`).
- A vector embedding write path exists (worker generates embeddings and stores them in Qdrant), but the repository does not include a retrieval path in the web app; this is an incomplete feature boundary at present (`coreader-worker/qdrant.go`).

## Repository evidence

- `infra/docker-compose.yaml`
- `infra/ollama-entrypoint.sh`
- `scripts/dev.ps1`, `scripts/dev.sh`
- `coreader-app/app/uploads/actions.ts`
- `coreader-app/app/api/files/[id]/download/route.ts`
- `coreader-app/app/reader/[bookId]/page.tsx`
- `coreader-app/lib/auth/*`
- `coreader-worker/main.go`
- `coreader-worker/db.go`
- `coreader-worker/process_file.go`
- `coreader-worker/qdrant.go`
- `infra/db/migrations/20251221235500-init.js`
- `infra/db/schemas/*.schema.json`

## Open questions / assumptions

- There is clear evidence of embedding storage in Qdrant, but not of embedding retrieval. Any architecture diagrams should distinguish embedding write path (implemented) from semantic search/RAG read path (not evidenced).
- In host-mode development, the web app and worker must share `FILE_STORAGE_ROOT`. The repository assumes this through configuration but does not include explicit coordination or health checks for storage consistency.
- The worker's OpenAI mode (`AI_CLIENT=openai`) does not support embedding generation in the current implementation (`coreader-worker/llm/aiProvider.go`). It is unclear whether embedding generation is intended to be optional under this mode or whether provider support is incomplete.
