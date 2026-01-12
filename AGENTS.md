# AGENTS.md

Default instructions for AI agents working in this repository. Nested AGENTS.md files override this one.

## General rules

- Keep changes focused and minimal; do not add dependencies or refactor unrelated code unless asked.
- Never commit secrets, credentials, or real tokens.
- Prefer existing tooling and conventions; document env vars in scripts.
- This repo uses npm workspaces (root package.json). Manage JS deps from repo root and keep only the root package-lock.json (do not recreate coreader-app/package-lock.json).
- If follow-up work is needed, add to TODO.md with `- [workspace]: description`.

## Project at a glance

- Next.js app (`coreader-app`) handles uploads, library, and reading; Go worker (`coreader-worker`) processes files into books with LLM help; MongoDB + local storage power persistence; infra (`infra/`) wires Mongo/Ollama/docker helpers.
- Text diagram: Users -> Next.js upload/API -> Mongo `files` + disk storage -> Go worker reads `files`, creates `books` + `bookChunks` + `entities` + `entity-mentions` -> Next.js Library/Reader render from Mongo.

## Services and responsibilities

| Component        | Owns                                                                               | Does NOT own                           |
| ---------------- | ---------------------------------------------------------------------------------- | -------------------------------------- |
| coreader-app     | Routes/UI, upload server actions, DB reads, file storage helper                    | Long-running processing, schema design |
| coreader-worker  | File reading, chunking, LLM calls, writing books/chunks/entities, progress updates | Frontend rendering, HTTP API           |
| infra/ + scripts | Mongo/LLM docker compose, JSON schemas, migrations, typegen                        | Feature logic in app/worker            |

## Database & schemas

- Source of truth: JSON Schemas in `infra/db/schemas/*.schema.json`.
- Validators: generated into `infra/db/validators/` by `npm run db:types`; applied/updated via migration `infra/db/migrations/20251221235500-init.js` run with `npm run db:migrate` (uses `infra/db/scripts/migrate.js`).
- Types: `npm run db:types` runs `infra/db/scripts/generate-types.js` -> TypeScript types at `coreader-app/lib/db/generated/db-types.ts` and Go structs at `coreader-worker/dbtypes.go`, then formats (`npm run format` inside app, `go fmt`).
- Conventions: ObjectId fields use `format: "objectId"`; timestamps use `format: "date-time"`; enums declared in schema (e.g., `files.status`, `books.source`); `additionalProperties: false` throughout; no custom indexes beyond `_id` unless added in migrations (none observed).
- Collections:
  - `files`: Stored files with processing status; includes `userId` to track uploader.
  - `books`: Book metadata created by worker from files; `source` field indicates origin.
  - `books-chunks`: Text chunks of books with LLM-analyzed entities.
  - `entities`: Canonical entity records with distilled descriptions (characters, places, etc.).
  - `entity-mentions`: Individual entity mentions within chunks with extracted facts.
  - `users`: User authentication and profile data.
  - `sessions`: User authentication sessions.
  - `user-books`: Links users to books (ownership + reading progress); used for authorization and "My Library" queries. Has unique index on `(userId, bookId)`, indexes on `userId` and `bookId`.

## Core workflows (paths to change)

- Upload -> file doc: `/uploads` UI + server actions `app/uploads/actions.ts` call `lib/files/storage.ts` (writes to `FILE_STORAGE_ROOT`) and `lib/db/files.ts` (inserts `files` doc with `userId` of uploader, status `pending`, revalidates `/uploads`).
- Processing -> book creation: Worker entry `coreader-worker/main.go` finds pending/processing files (`db.go:GetUnprocessedFiles`), reads from storage (`storage.go`), splits (`chunking.go`), LLM header/entity analysis (`llm.go`), writes `books`, `bookChunks` with entity references (`db.go`), then post-processes to create canonical `entities` and `entity-mentions` (`entity_postprocessing.go`), updates `files.status`/`percentage`. If file has `userId`, creates `user-books` link to establish ownership.
- Reading UI: Library listing `app/library/page.tsx` via `lib/db/books.ts` filtered by user ownership (via `user-books`); Reader page `app/reader/[bookId]/page.tsx` checks ownership via `user-books`, pulls chunks via `lib/db/book-chunks.ts`, updates reading progress in `user-books`; uploads list with book links via `lib/db/files.ts`.
- Download: `/api/files/[id]/download/route.ts` streams stored file from `FILE_STORAGE_ROOT` after checking ownership via `files.userId`.
- Authorization: All book/file operations check ownership via `user-books` collection or `files.userId` field; unauthenticated users see empty lists.

## Pages & UX map (coreader-app)

- `/` Home dashboard (overview cards: `app/WorkspaceOverview.tsx`, actions/tips components).
- `/uploads` Upload management (`app/uploads/*` components, dropzone + table; see `FUNCTIONALITIES.md` in folder).
- `/library` Book grid/list (`app/library/LibraryClientPage.tsx`).
- `/reader/[bookId]` Reader view with pagination over chunks (`app/reader/[bookId]/page.tsx` + `ReaderClientPage.tsx`).
- Shared UI: `ui/` (buttons, forms), layout/header/footer in `app/layout.tsx`, `app/Header.tsx`, `app/Footer.tsx`.

## Where to change what (decision cues)

- Frontend UI/UX or server actions -> `coreader-app` (`app/` routes, `lib/db/*`, `lib/files/*`, `ui/`).
- Processing logic, chunking, LLM prompts, DB writes on ingest -> `coreader-worker` (Go files).
- Schema/migrations/type generation or infra scripts -> `infra/` (`db/schemas`, `db/scripts`, `docker-compose`).
- Cross-cutting DB shape changes -> update schema -> run `npm run db:types` -> commit regenerated TS/Go files and validators -> ensure `npm run db:migrate` aligns.

## PR checklist for agents

- Follow commit format `[type]: (AI:{ainame}) description`; prefer `docs` type for instruction updates.
- Run relevant checks: `npm run lint` (when frontend code touched); `goimports -w <files>` (Go edits) and `go test -short ./...` if tests exist; `npm run db:types` + `npm run db:migrate` when schemas change.
- Keep changes scoped; avoid new deps; note skipped checks with rationale; update TODO.md for leftover work.
  NOTE: if `goimports` is not available, install it via `go install golang.org/x/tools/cmd/goimports@latest`.
