# User workflows and assisted reading

## Authentication and identity

The application implements a custom authentication system based on:

- A `users` collection storing `email` and `passwordHash` (`infra/db/schemas/users.schema.json`).
- A `sessions` collection storing session tokens and expiration timestamps (`infra/db/schemas/sessions.schema.json`).
- An HTTP-only cookie `session_token` used to identify the current session (`coreader-app/lib/auth/cookies.ts`).

Login and registration are implemented as server actions (`coreader-app/app/auth/actions.ts`). On successful login or registration, the app creates a session token in MongoDB and sets the cookie. Logout deletes the session and clears the cookie. Password changes delete all sessions for the user and create a new session, which forces re-authentication across devices (`coreader-app/app/account/actions.ts`, `coreader-app/lib/auth/sessions.ts`).

This model enables user-scoped access control (ownership checks) and per-user libraries.

## Workflow 1: Uploading a document

### UI surface and user intent

The Uploads page (`/uploads`) provides:

- File selection via a dropzone.
- A table showing upload status and processing progress.
- Search/filter/sort controls for uploaded files.
- Actions per file: download original, retry (for failed), delete.

These behaviors are described both in UI code and a dedicated functional description file (`coreader-app/app/uploads/FUNCTIONALITIES.md`).

### Server-side ingestion and persistence

On upload, the web app:

1. Writes the file bytes to disk under `FILE_STORAGE_ROOT/files/` using a random UUID filename (`coreader-app/lib/files/storage.ts`).
2. Inserts a `files` document in MongoDB with `status: "pending"`, progress initialized, and ownership (`userId`) when authenticated (`coreader-app/app/uploads/actions.ts`, `coreader-app/lib/db/files.ts`).

### Status updates and retry

Uploads status is not pushed from the backend; the UI periodically polls the server to refresh metadata when any file is in `processing` state (`coreader-app/app/uploads/UploadsClientPage.tsx`). Retry is implemented by resetting the file state back to `pending` and clearing error messages (`resetFileForReprocessing` in `coreader-app/lib/db/files.ts`, invoked by `reprocessFileAction`).

## Workflow 2: Building and browsing the library

The Library page (`/library`) lists books owned by the current user. Ownership is represented by the `user-books` collection, which links `userId` and `bookId` and stores reading progress metadata (`infra/db/schemas/user-books.schema.json`).

The library supports:

- Search by title/author in the UI (client-side filtering; `coreader-app/app/library/LibraryClientPage.tsx`).
- Filters such as reading/unread/finished/pinned, and pin toggling via a server action (`coreader-app/app/library/actions.ts` calling `setBookPinState` in `coreader-app/lib/db/user-books.ts`).
- Periodic polling while books are not yet processed (`processed !== true`), suggesting that the UI expects library items to appear before processing completes (`coreader-app/app/library/LibraryClientPage.tsx`).

## Workflow 3: Reading with assistance

### Access control and page model

The reader route (`/reader/[bookId]`) is a server-rendered page that:

- Ensures a user is authenticated (redirects to `/login` when missing).
- Verifies the user owns the book via `user-books` (`userOwnsBook` in `coreader-app/lib/db/user-books.ts`).
- Fetches the requested chunk by index and treats it as a page; the URL parameter `?page=` is 1-based in the UI but converted to 0-based chunk indices internally (`coreader-app/app/reader/[bookId]/page.tsx`, `coreader-app/lib/db/book-chunks.ts`).

The reader updates reading progress in `user-books` on every page render, including `lastOpenedAt` and `progressPercent` (`updateReadingProgress` in `coreader-app/lib/db/user-books.ts`).

### Assisted reading features implemented

#### 1) Entity highlighting and entity popups

Entities are highlighted directly within the rendered text. This is enabled by:

- Chunk-level entity offsets (`startOffsets[]`) computed during ingestion and stored in `books-chunks`.
- A UI mapping from chunk offsets to paragraph-local display offsets after paragraph normalization (line break normalization, trimming, and whitespace compaction) (`coreader-app/app/reader/[bookId]/chunkUtils.ts`).
- A canonical entity lookup in MongoDB, where entity IDs from the chunk are used to fetch distilled descriptions and facts (`coreader-app/app/reader/[bookId]/page.tsx`, `coreader-app/lib/db/entities.ts`).

When a user clicks an entity span, an `EntityPopup` displays its canonical name, type, and a description if post-processing produced one (`coreader-app/app/reader/[bookId]/EntityPopup.tsx`).

#### 2) Table of contents (chapter navigation)

The worker extracts chapter heading candidates per chunk and aggregates a deduplicated chapter list in the `books` document. The reader maps chapter chunk IDs to page numbers and displays chapters in a TOC panel (`coreader-app/app/reader/[bookId]/page.tsx`, `coreader-worker/process_file.go`).

This provides navigational assistance beyond sequential paging, even though chapter identification is heuristic and LLM-dependent.

#### 3) Local text search (within the current page)

The reader contains a Search panel that searches the current page blocks by case-insensitive substring match and produces snippets around the match (`coreader-app/app/reader/[bookId]/ReaderClientPage.tsx`, panel UI in `coreader-app/app/reader/[bookId]/ReaderPanels.tsx`).

This is a non-semantic search; it does not query Qdrant and does not span the whole book unless the user navigates page by page.

#### 4) Highlights and reading settings

The reader supports basic highlights (select text, then highlight), but highlights are stored in React state and are not persisted to MongoDB in the inspected code (`coreader-app/app/reader/[bookId]/ReaderClientPage.tsx`). Reader settings (font size, line height, content width) are purely client-side.

#### 5) "Coach" panel (placeholder)

The UI includes a Coach panel designed for chat/RAG, but it is explicitly marked as a placeholder (Soon) and does not connect to a backend (`coreader-app/app/reader/[bookId]/ReaderPanels.tsx`). In a thesis context, this should be described as a design intention rather than an implemented feature.

## Repository evidence

- `coreader-app/app/auth/actions.ts`
- `coreader-app/lib/auth/cookies.ts`
- `coreader-app/lib/auth/sessions.ts`
- `coreader-app/app/uploads/FUNCTIONALITIES.md`
- `coreader-app/app/uploads/actions.ts`
- `coreader-app/app/uploads/UploadsClientPage.tsx`
- `coreader-app/app/library/actions.ts`
- `coreader-app/app/library/LibraryClientPage.tsx`
- `coreader-app/app/reader/[bookId]/page.tsx`
- `coreader-app/app/reader/[bookId]/ReaderClientPage.tsx`
- `coreader-app/app/reader/[bookId]/ReaderPanels.tsx`
- `coreader-app/app/reader/[bookId]/chunkUtils.ts`
- `coreader-worker/process_file.go`
- `infra/db/schemas/user-books.schema.json`

## Open questions / assumptions

- The reader redirects unauthenticated users to `/login`, but the repository does not include a `coreader-app/app/login` route; authentication UI appears to be implemented via modals in the header. This indicates `/login` may be a placeholder or depends on routing not shown.
- The reader's entity panel is "entities on this page", not a global entity index for the whole book. It is unclear whether a global entity browser is planned.
- Highlights are not persisted; if persistent annotations are part of the thesis scope, additional storage and UI work would be needed.
- Search is currently lexical and page-local; a semantic search feature would require wiring Qdrant retrieval into the web app and defining navigation from hit to page.
