# Implementation details

## Technology stack

### Web application

The `coreader-app` service is implemented using:

- Next.js (App Router) and React (`coreader-app/package.json`).
- TypeScript for application code.
- MongoDB Node.js driver (`mongodb` dependency).
- Tailwind CSS for styling, plus Prettier and ESLint for formatting and linting (`coreader-app/package.json`, `coreader-app/eslint.config.mjs`, `coreader-app/.prettierrc`).

The route model is Next.js App Router under `coreader-app/app/`, with server actions used for mutations (uploads, auth, account changes) and route handlers used for explicit HTTP endpoints (e.g., file downloads).

### Processing worker

The `coreader-worker` service is implemented in Go and depends on:

- MongoDB Go driver (`go.mongodb.org/mongo-driver`, used in `coreader-worker/db.go`).
- Qdrant Go client (`github.com/qdrant/go-client/qdrant`, used in `coreader-worker/qdrant.go`).
- Ollama Go client API (`github.com/ollama/ollama/api`, used in `coreader-worker/llm/ollama.go`).
- A provider abstraction library (`github.com/cecil-the-coder/ai-provider-kit/...`) used for OpenAI-mode chat completions (`coreader-worker/llm/aiProvider.go`).

## Configuration and environment variables

Configuration is primarily environment-driven. Evidence sources include `infra/docker-compose.yaml`, `coreader-app/README.md`, and worker code. Key variables include:

- Storage: `FILE_STORAGE_ROOT` (required for both app and worker).
- MongoDB: `MONGODB_URI`, `MONGODB_DB_NAME`.
- LLM: `AI_CLIENT` (`ollama` default), `LLM_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_EMBEDDING_MODEL`, `OPENAI_API_KEY`, `OPENAI_MODEL`.
- Qdrant: `QDRANT_HOST`, `QDRANT_PORT`, `QDRANT_VECTOR_DIMENSION`.

The repository provides scripts to start infra-only services and run app+worker locally (`scripts/dev.ps1`, `scripts/dev.sh`), as well as fully dockerized operation (`scripts/up-docker.ps1`, `scripts/up-docker.sh`).

## Database schema enforcement and type generation

The repository enforces strict MongoDB collection validators derived from JSON Schemas:

- Schemas live in `infra/db/schemas/*.schema.json`.
- `infra/db/scripts/generate-types.js` generates:
  - TS types at `coreader-app/lib/db/generated/db-types.ts`,
  - Go structs at `coreader-worker/dbtypes.go`,
  - BSON validator JSON at `infra/db/validators/*.schema.json`.
- The migration `infra/db/migrations/20251221235500-init.js` applies validators using `collMod`/`createCollection` with `validationAction: "error"`.

On the application side, MongoDB operations are wrapped with `withMongoValidation` to convert schema validation errors (Mongo code 121) into readable error messages (`coreader-app/lib/db/mongo.ts`).

## Worker orchestration, concurrency, and failure behavior

### Job acquisition and concurrency

The worker polls for pending files and caps parallel processing at three concurrent files using a semaphore (`sem := make(chan struct{}, 3)`) (`coreader-worker/db.go`). This bounds concurrent work but does not implement scheduling based on file size or resource usage.

### Error handling and cleanup

Processing is orchestrated by `ProcessFile`, which records processing timestamps, calls `processFileInternal`, and on failure:

- Attempts to delete partially created book data (`DeleteBookData`).
- Appends an error entry to file error history.
- Sets `files.status = "failed"` (`coreader-worker/process_file.go`, `coreader-worker/db.go`).

This behavior supports retriable processing via UI ("Retry" resets status back to `pending`), but it does not provide at-least-once semantics with idempotent Qdrant cleanup, which is relevant for future reliability work.

## LLM prompting and response constraints

The LLM integration is designed around strict JSON outputs:

- Prompt templates include explicit JSON schemas, and for chunk analysis and entity processing the worker passes a `Format` object (`coreader-worker/llm/schemas.go`) to the LLM client.
- In the Ollama client implementation, `options.Format != nil` is used to request JSON output (`req.Format = "json"`), but schema enforcement depends on prompt discipline rather than a hard server-side schema validator (`coreader-worker/llm/ollama.go`).
- Chunk analysis includes a split-and-retry mechanism for parse failures, indicating that JSON responses can fail to parse in practice (`coreader-worker/llm/helpers.go`).

Offsets for entities are computed deterministically after extraction by exact substring search, rather than relying on the model to provide offsets (`coreader-worker/llm/helpers.go`).

## Testing and validation approaches present in the repo

### Web application tests

The web app includes:

- Jest configuration (`coreader-app/jest.config.mjs`, `coreader-app/jest.setup.tsx`) for unit/component testing.
- Playwright configuration (`coreader-app/playwright.config.ts`) and an `e2e/` folder for end-to-end tests.

### Worker tests

The worker includes Go tests for:

- Chunking (`coreader-worker/chunking_test.go`).
- Storage reading (`coreader-worker/storage_test.go`).
- Entity post-processing logic (`coreader-worker/entity_postprocessing_test.go`).
- Qdrant integration tests that can be skipped based on environment (`coreader-worker/qdrant_test.go`).

These tests cover deterministic components (chunking, storage, post-processing helpers). Coverage of LLM outputs remains limited because LLM responses are external and non-deterministic unless mocked.

## Repository evidence

- `package.json`
- `coreader-app/package.json`
- `coreader-worker/go.mod`
- `infra/docker-compose.yaml`
- `scripts/dev.ps1`, `scripts/dev.sh`, `scripts/up-docker.ps1`, `scripts/up-docker.sh`
- `infra/db/schemas/*.schema.json`
- `infra/db/scripts/generate-types.js`
- `infra/db/migrations/20251221235500-init.js`
- `coreader-app/lib/db/mongo.ts`
- `coreader-worker/process_file.go`
- `coreader-worker/llm/helpers.go`
- `coreader-worker/llm/ollama.go`
- `coreader-worker/qdrant.go`
- `coreader-app/jest.config.mjs`
- `coreader-app/playwright.config.ts`
- `coreader-worker/*_test.go`

## Open questions / assumptions

- The strict JSON schema `Format` mechanism is implemented differently between providers: in Ollama mode it requests JSON but does not transmit the schema itself; in OpenAI/provider-kit mode it serializes a schema JSON string. The practical reliability difference is not fully evident without runtime logs.
- The book-header analysis path appears to have a schema/prompt mismatch: `BookHeaderFormat()` in `coreader-worker/llm/schemas.go` requires fields such as `headerEndOffset`, but the prompt in `coreader-worker/llm/helpers.go` does not request them and the `BookHeaderMetadata` struct omits them. It is unclear which representation is intended to be authoritative.
- The worker stores embeddings in Qdrant but does not expose retrieval logic. If semantic search is a thesis focus, additional implementation is required.
- Some UI strings and metadata appear to contain encoding artifacts (e.g., app title in `coreader-app/app/layout.tsx`), which may reflect environment encoding rather than a design decision.
