# Repository evidence map (ai-coreader)

This document is a compact map of the repository, meant to support thesis-oriented writing. It focuses on where implementation evidence lives (code, schemas, infra), and how that evidence can be cited in later chapters.

## Repository layout (top-level)

The repository is organized as a small system with two main runtimes (a web application and a background worker), plus infrastructure scripts:

- `coreader-app/`: Next.js (App Router) web application responsible for UI, authentication, uploads, and reading experience.
- `coreader-worker/`: Go worker responsible for asynchronous document processing: chunking, LLM-based analysis, embedding generation, and persistence.
- `infra/`: Docker Compose stack for MongoDB, an LLM endpoint (Ollama), and Qdrant (vector database). Also contains DB schemas/migrations/type generation scripts.
- `scripts/`: Cross-platform developer helpers to start the stack and reset data.
- `storage/`: Local persistence directory used by Docker volumes and file uploads (Mongo/Qdrant/Ollama models + uploaded files).

Root workspace management is implemented via npm scripts and workspaces in `package.json` (root), with `coreader-app` as the main JS workspace.

## Main services/modules and responsibilities

### 1) Web application (`coreader-app/`)

**Primary responsibilities (observed in code):**

- User authentication via Mongo-backed sessions and an HTTP-only cookie (`session_token`).
- File upload workflow: accept `.txt`, store binary on disk, store metadata in MongoDB (`files` collection).
- User-facing workflows: Uploads dashboard (`/uploads`), Library (`/library`), Reader (`/reader/[bookId]`), Account management (`/account`).
- Authorization model: access to books/files is mediated through ownership links (`user-books`) and per-file `userId`.

**Key evidence locations:**

- Routes and UI: `coreader-app/app/` (App Router).
- Upload server actions: `coreader-app/app/uploads/actions.ts`.
- Storage utilities: `coreader-app/lib/files/storage.ts`.
- Mongo access layer: `coreader-app/lib/db/*` (DTO mappers and query functions).
- Auth utilities: `coreader-app/lib/auth/*` and `coreader-app/app/auth/actions.ts`.
- Reader UI and assistance features: `coreader-app/app/reader/[bookId]/*` (entity highlights, table of contents, local search, highlights, placeholder "coach" panel).

### 2) Background worker (`coreader-worker/`)

**Primary responsibilities (observed in code):**

- Poll for new `files` documents in MongoDB with `status: pending`, then process them asynchronously.
- Load the raw uploaded file from local storage (`FILE_STORAGE_ROOT`), chunk it into logical segments, store chunks in `books-chunks`.
- For each chunk:
  - Generate an embedding via the configured LLM client and store it in Qdrant.
  - Extract named entities and candidate chapter headings via LLM completion (JSON-only output), then persist metadata to MongoDB.
- After chunk processing:
  - Deduplicate chapter headings and store a normalized chapter list on the `books` document.
  - Run a post-processing phase that consolidates chunk-level entities into canonical `entities` records and creates `entity-mentions` entries with extracted facts and distilled descriptions.

**Key evidence locations:**

- Worker entrypoint and orchestration: `coreader-worker/main.go`, `coreader-worker/db.go`, `coreader-worker/process_file.go`.
- Chunking algorithm: `coreader-worker/chunking.go`.
- File storage access: `coreader-worker/storage.go`.
- LLM interaction layer: `coreader-worker/llm/*` (provider selection, prompts, strict JSON schema formats, embedding calls).
- Vector store integration: `coreader-worker/qdrant.go`.
- Entity post-processing and fact extraction: `coreader-worker/entity_postprocessing.go` and design notes in `coreader-worker/ENTITY_POSTPROCESSING.md`.

### 3) Infrastructure (`infra/` + `scripts/`)

**Primary responsibilities (observed in code):**

- Run MongoDB, Ollama, and Qdrant via Docker Compose profiles (`infra` for infra-only; `stack` for full dockerized app+worker).
- Pull required Ollama models on startup (generation + embedding model).
- Provide schema-first MongoDB collection validation:
  - JSON Schemas are the source of truth in `infra/db/schemas/*.schema.json`.
  - Validators are generated into `infra/db/validators/` and applied via migrations in `infra/db/migrations/`.
  - Type generation produces TS types (`coreader-app/lib/db/generated/db-types.ts`) and Go structs (`coreader-worker/dbtypes.go`).

**Key evidence locations:**

- Docker stack: `infra/docker-compose.yaml`, `infra/ollama-entrypoint.sh`.
- DB schemas: `infra/db/schemas/*.schema.json`.
- DB migrations: `infra/db/migrations/*.js`.
- Type generation / migration scripts: `infra/db/scripts/generate-types.js`, `infra/db/scripts/migrate.js`.
- Dev helpers: `scripts/dev.ps1`, `scripts/dev.sh`, `scripts/up-docker.ps1`, `scripts/up-docker.sh`, `scripts/reset-infra.ps1`, `scripts/reset-infra.sh`.

## Data model evidence (MongoDB collections)

The data model is formally defined by JSON Schemas (and enforced via MongoDB validators) rather than being implicit in application code. The most relevant schema files are:

- `infra/db/schemas/files.schema.json`: file metadata + processing state (`pending|processing|processed|failed`), progress percentage, and uploader `userId`.
- `infra/db/schemas/books.schema.json`: book-level metadata, `totalChunks`, `processed` flag, `source`, and optional chapter list.
- `infra/db/schemas/books-chunks.schema.json`: chunk text and LLM-derived fields (`entities`, `chapters`, and `llmProcessed`).
- `infra/db/schemas/entities.schema.json`: canonical entity record per book (name/type, mention counts, distilled description + key facts).
- `infra/db/schemas/entity-mentions.schema.json`: per-chunk mention entries with snippet + extracted facts (including a `factType` that can include `relationship` as a fact category).
- `infra/db/schemas/user-books.schema.json`: ownership link plus reading progress metadata.
- `infra/db/schemas/users.schema.json`, `infra/db/schemas/sessions.schema.json`: authentication model.

Indexes and uniqueness constraints are applied via migrations (e.g., for `user-books`, `entities`, and `entity-mentions`) in `infra/db/migrations/`.

## Evidence pointers by thesis chapter

The following mapping indicates which parts of the repo are likely to support each thesis chapter. It is meant as a starting point; chapters can cite additional files discovered later.

### 01 - System overview

- `README.md`
- `coreader-app/README.md`
- `coreader-worker/main.go`
- `infra/docker-compose.yaml`

### 02 - Architecture

- `infra/docker-compose.yaml` (Mongo + Ollama + Qdrant, and optional containers)
- `scripts/README.md`, `scripts/dev.ps1`, `scripts/dev.sh` (how components are started together)
- `coreader-app/app/*` (web UI/service boundary)
- `coreader-worker/*` (worker boundary)

### 03 - Document processing pipeline

- `coreader-app/app/uploads/actions.ts`, `coreader-app/lib/files/storage.ts`, `coreader-app/lib/db/files.ts` (ingestion)
- `coreader-worker/process_file.go`, `coreader-worker/chunking.go`, `coreader-worker/storage.go` (chunking + processing)
- `coreader-worker/llm/helpers.go` (chunk analysis prompt)
- `coreader-worker/entity_postprocessing.go` (post-processing phase)

### 04 - Semantic analysis and embeddings

- `coreader-worker/llm/ollama.go` (embedding model + API calls)
- `coreader-worker/llm/helpers.go` (`GenerateEmbedding`)
- `coreader-worker/qdrant.go` (embedding persistence in Qdrant)
- `infra/ollama-entrypoint.sh` (model pulling)

### 05 - Entity and relation extraction

- `coreader-worker/llm/helpers.go` (named entity extraction prompt; conservative rules)
- `coreader-worker/entity_postprocessing.go` (mention snippets, fact extraction, distillation)
- `coreader-worker/llm/entity_processing.go` (fact extraction + distillation prompts)
- `infra/db/schemas/entities.schema.json`, `infra/db/schemas/entity-mentions.schema.json`

### 06 - Storage and data model

- `infra/db/schemas/*.schema.json` (source of truth)
- `infra/db/migrations/*.js` (validators and indexes)
- `infra/db/scripts/generate-types.js` (types/validators generation)
- `coreader-app/lib/db/*` and `coreader-worker/db.go` (usage)

### 07 - User workflows and assisted reading

- Uploads UX and polling: `coreader-app/app/uploads/*` (including `FUNCTIONALITIES.md`)
- Library UX and pinning/progress: `coreader-app/app/library/*`
- Reader UX: `coreader-app/app/reader/[bookId]/*` (entity highlighting + popups, TOC, local text search, highlights; "coach" is a placeholder panel)
- Auth flows: `coreader-app/app/auth/actions.ts`, `coreader-app/lib/auth/*`

### 08 - Implementation details

- Tech stack and scripts: `package.json` (root), `coreader-app/package.json`, `coreader-worker/go.mod`
- DB tooling: `infra/db/scripts/*`, `infra/db/migrations/*`
- Validation/error handling: `coreader-app/lib/db/mongo.ts`, worker error handling in `coreader-worker/process_file.go`
- Testing: `coreader-app/jest.config.mjs`, `coreader-app/playwright.config.ts`, Go tests in `coreader-worker/*_test.go`

### 09 - Limitations and future improvements

- TODO markers: `coreader-worker/db.go` (polling), `coreader-app/app/uploads/UploadsClientPage.tsx`, `coreader-app/app/library/LibraryClientPage.tsx`
- Placeholder features: `coreader-app/app/reader/[bookId]/ReaderPanels.tsx` (Coach panel marked "Soon")
- Qdrant usage without retrieval in app (embedding persistence exists, search integration appears incomplete)

### 10 - Evaluation ideas

- Entity extraction and post-processing components: `coreader-worker/llm/helpers.go`, `coreader-worker/entity_postprocessing.go`
- Data schemas enabling measurement: `infra/db/schemas/entity-mentions.schema.json`, `infra/db/schemas/entities.schema.json`
- Reader UX surfaces for user studies: `coreader-app/app/reader/[bookId]/*`, `coreader-app/app/library/*`

## Repository evidence

- `README.md`
- `package.json`
- `scripts/README.md`
- `infra/docker-compose.yaml`
- `infra/db/schemas/*.schema.json`
- `coreader-app/app/*`, `coreader-app/lib/*`
- `coreader-worker/*`, `coreader-worker/llm/*`

## Open questions / assumptions

- Qdrant embeddings are generated and stored by the worker, but the repository evidence does not show a semantic-search or vector-retrieval API path used by the web app (no Qdrant query path in `coreader-app/` was identified). This indicates incomplete integration or future work.
- A Coach/chat panel exists in the reader UI, but it is explicitly marked as a placeholder and does not appear to be connected to a backend.
- The system supports `AI_CLIENT=openai` in the worker, but embedding generation for the OpenAI path is explicitly not supported in the current implementation; end-to-end behavior for OpenAI mode is therefore uncertain.
