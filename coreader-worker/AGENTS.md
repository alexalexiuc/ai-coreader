Worker-specific guidance (inherits root AGENTS.md).

## Pipeline essentials

- Entry: `main.go` fetches `pending`/`processing` files via `db.go:GetUnprocessedFiles`, then `ProcessFile` drives the pipeline.
- Processing steps (`processFile.go`): set file status → chunk file (`storage.go` + `chunking.go`) → create `books` + `bookChunks` → analyze header/entities with `llm.go` → persist entities (`entityDescriptions`) → update progress/status.
- Chunking constants live in `processFile.go` (`CHUNK_SIZE_*`, `MAX_ENDING_SEARCH_CHARS`); adjust carefully to avoid memory spikes.
- Storage root is `FILE_STORAGE_ROOT`; file paths combine `storagePath` + `storageName` from the `files` doc.

## Data & schemas

- Types come from the generated `dbtypes.go` (regen via root `npm run db:types` when schemas change). Do not hand-edit the file.
- Mongo helpers: use `db.go` helpers (`InsertOneWithMeta`, `UpdateOneWithMeta`) to keep `createdAt`/`updatedAt` aligned with schema requirements.
- Status flow: file `status` transitions `pending → processing → processed` (or `failed` if you add error handling); book `processed` flag is set at the end of `ProcessFile`.

## LLM client

- package llm abstracts LLM calls; switch clients via `AI_CLIENT` env var (`ollama` only for now).
- Ollama defaults: `OLLAMA_BASE_URL` (default `http://llm:11434`), `OLLAMA_MODEL` (default `phi4:mini`). Requests live in `llm/helpers.go` with JSON-only responses; keep prompts deterministic where possible.

## Coding standards

- Always `gofmt -w` touched files; prefer explicit errors over panics; pass `context.Context` into external calls.
- For retries/idempotency changes, ensure repeated runs won’t duplicate books/chunks/entities (check existing find-or-create logic in `ProcessFile`).
