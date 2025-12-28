Frontend-specific guidance (inherits root AGENTS.md).

## Conventions

- Next.js App Router + TypeScript. Prefer server components; mark client components only when using hooks/refs/state.
- Styling: Tailwind + Prettier. Do not hand-format; run `npm run lint` when touching TS/TSX.
- Shared UI lives in `ui/`; keep route-specific UI under its route folder (`app/<route>/`).
- Storage: `FILE_STORAGE_ROOT` must be set; file operations go through `lib/files/storage.ts`.

## Data access

- Use generated types in `lib/db/generated/db-types.ts`; do not hand-roll duplicates. If schemas change, rerun `npm run db:types`.
- Mongo helpers: use `lib/db/mongo.ts` for connection + validation-friendly error formatting; prefer the DTO mappers in `lib/db/books.ts`, `lib/db/files.ts`, `lib/db/book-chunks.ts`.
- Server actions (e.g., `app/uploads/actions.ts`) should revalidate relevant paths with `revalidatePath`.

## Routing & UX cues

- Pages: `/` (dashboard cards), `/uploads` (upload + status table; behaviors documented in `app/uploads/FUNCTIONALITIES.md`), `/library` (book list), `/reader/[bookId]` (chunked reader).
- API route for downloads: `app/api/files/[id]/download/route.ts` streams from disk.
- Reader pagination uses chunk index (`lib/db/book-chunks.ts`); keep page=1-based in URLs.

## Testing/checks

- Run `npm run lint` for TS/TSX changes; `npm run format -- <files>` is invoked automatically by `npm run db:types`.
- Keep client/server boundaries clean; avoid adding dependencies unless required by the task.
