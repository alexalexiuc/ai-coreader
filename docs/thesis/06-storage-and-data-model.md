# Storage and data model

## Design principles evident in the repository

The repository adopts a schema-first approach for persistence:

- JSON Schemas in `infra/db/schemas/*.schema.json` are the source of truth for MongoDB collections.
- Validators are generated and applied to collections using migrations, enforcing strict schema compliance (`infra/db/migrations/20251221235500-init.js`).
- Types are generated from the same schemas for both TypeScript and Go, reducing drift between services (`infra/db/scripts/generate-types.js` produces `coreader-app/lib/db/generated/db-types.ts` and `coreader-worker/dbtypes.go`).

This approach provides a formal, inspectable definition of the system's data model and constraints (schemas, validators, and generated types).

## Physical storage layers

### 1) Local filesystem storage for uploaded files

Uploaded documents are stored on disk under `FILE_STORAGE_ROOT`, within subfolders such as `files/` (`coreader-app/lib/files/storage.ts`). MongoDB stores only metadata and a reference (`storagePath`, `storageName`) (`infra/db/schemas/files.schema.json`).

Operationally, this means the web app and worker must have access to the same storage root. In dockerized mode, this is achieved by mounting `../storage` into both app and worker containers (`infra/docker-compose.yaml`).

### 2) MongoDB for structured metadata and annotations

MongoDB stores all structured artifacts used by the UI and the processing pipeline. Collection validators are enforced in the database, which makes persistence errors explicit and prevents silent corruption.

### 3) Qdrant for vector embeddings

Qdrant stores chunk embeddings in the `book_chunks` collection and includes payload fields to link back to MongoDB (`coreader-worker/qdrant.go`). The repository provisions Qdrant in `infra/docker-compose.yaml` and the worker writes embeddings, but the web app does not include evidence of querying Qdrant in the inspected code.

## MongoDB collections and relationships

The following summarizes the main collections, their roles, and how they relate. Field-level details are defined in the schemas.

### `users` and `sessions`: authentication model

- `users` (`infra/db/schemas/users.schema.json`) stores email and `passwordHash`, plus optional profile fields.
- `sessions` (`infra/db/schemas/sessions.schema.json`) stores session tokens with `expiresAt`.

The application uses an HTTP-only cookie (`session_token`) to map requests to a session token, then resolves the current user via a MongoDB lookup (`coreader-app/lib/auth/cookies.ts`, `coreader-app/lib/auth/sessions.ts`).

### `files`: upload metadata and processing status

Schema: `infra/db/schemas/files.schema.json`.

Key fields:

- File identity and storage reference: `originalName`, `mimeType`, `size`, `storagePath`, `storageName`.
- Processing state: `status` (`pending|processing|processed|failed`), `percentage`, timestamps.
- Error diagnostics: `errorMessage` and `rawErrorMessage[]` (history).
- Ownership: `userId` (ObjectId).

This collection is also used as a job queue by the worker. The worker polls `files` for `status: pending`, updates progress, and sets final status (`coreader-worker/db.go`).

### `books`: processed document metadata

Schema: `infra/db/schemas/books.schema.json`.

Key fields:

- Link to source: `fileId`.
- Derived metadata: `title`, `author`, etc. (extracted from first chunk header analysis).
- Processing summary: `totalChars`, `totalChunks`, `processed` boolean.
- Source enumeration: `source` (`user_upload|shop`).
- Optional TOC: `chapters[]` with `chunkId` and `startOffset`.

The web app reads this collection to render the reader and library.

### `books-chunks`: per-chunk text and annotations

Schema: `infra/db/schemas/books-chunks.schema.json`.

Key fields:

- `bookId`, `index`, `startChar`, `endChar`, `text`, `llmProcessed`.
- Optional `entities[]`: each item has `entityId`, `name`, `type`, `startOffsets[]`.
- Optional `chapters[]`: raw chapter headings found in the chunk.

The reader uses chunk index as a page number. Entity highlighting relies on `startOffsets[]` and on the canonical entity info loaded from `entities` (`coreader-app/app/reader/[bookId]/page.tsx`, `coreader-app/lib/db/book-chunks.ts`, `coreader-app/lib/db/entities.ts`).

### `user-books`: ownership and reading progress

Schema: `infra/db/schemas/user-books.schema.json`.

Key fields:

- Ownership link: `userId`, `bookId`.
- Reading progress: `lastOpenedAt`, `lastPageIndex`, `lastChunkIndex`, `progressPercent`, etc.
- UX metadata: `isPinned`, `startedAt`, `finishedAt`.

An index enforces uniqueness on `(userId, bookId)` and supports library queries (`infra/db/migrations/20260104135000-add-user-books-collection.js`). Both the worker and the app can create/update `user-books` links:

- Worker creates a link when processing a file that has `userId` set (`coreader-worker/process_file.go`, `CreateOrUpdateUserBook` in `coreader-worker/db.go`).
- Web app updates reading progress when a user opens a reader page (`coreader-app/lib/db/user-books.ts`, called in `coreader-app/app/reader/[bookId]/page.tsx`).

### `entities` and `entity-mentions`: post-processed semantic layer

Schemas:

- `infra/db/schemas/entities.schema.json` (canonical entities).
- `infra/db/schemas/entity-mentions.schema.json` (mention-level records).

The worker populates these collections after processing all chunks (`coreader-worker/entity_postprocessing.go`). Indexes enforce uniqueness and support lookups by book and by entity (`infra/db/migrations/20260109000000-add-entity-postprocessing-collections.js`).

The web reader currently fetches entities by IDs referenced in the current chunk and shows a distilled description (when available) (`coreader-app/app/reader/[bookId]/page.tsx`, `coreader-app/lib/db/entities.ts`).

## Qdrant data model (vector layer)

The worker stores one embedding per chunk in Qdrant collection `book_chunks` (`coreader-worker/qdrant.go`). Each point includes:

- Vector: `[]float32` embedding.
- Payload:
  - `bookId` (string),
  - `chunkId` (string),
  - `chunkIndex` (integer).

This payload design supports later filtering and mapping back to MongoDB documents without duplicating chunk text in Qdrant.

## Repository evidence

- `infra/db/schemas/*.schema.json`
- `infra/db/migrations/20251221235500-init.js`
- `infra/db/migrations/20260104135000-add-user-books-collection.js`
- `infra/db/migrations/20260109000000-add-entity-postprocessing-collections.js`
- `infra/db/scripts/generate-types.js`
- `coreader-app/lib/files/storage.ts`
- `coreader-app/lib/db/*`
- `coreader-app/lib/auth/*`
- `coreader-worker/db.go`
- `coreader-worker/process_file.go`
- `coreader-worker/entity_postprocessing.go`
- `coreader-worker/qdrant.go`
- `infra/docker-compose.yaml`

## Open questions / assumptions

- There is no explicit cascade deletion strategy across collections (e.g., deleting a `files` record does not necessarily delete `books`, `books-chunks`, `entities`, and Qdrant points). The intended lifecycle model for cleanup is not fully specified in the repository.
- The use of Qdrant is currently write-only in the inspected code. If semantic retrieval is intended, the query and filtering model should be documented separately once implemented.
- The storage path conventions assume a single shared `FILE_STORAGE_ROOT`. In multi-host deployments, this would require shared storage or object storage, which is not present in the current repo.
