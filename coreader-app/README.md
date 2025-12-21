# CoReader App

AI Co-Reader is a Next.js 16 + React 19 application for uploading plain text books, storing them on disk, tracking metadata in MongoDB, and browsing the processed library.

## Tech stack
- Next.js (App Router) with TypeScript and modern fonts via `next/font`
- MongoDB for file metadata (`lib/db/*`)
- Local filesystem storage for uploaded files (`lib/files/storage.ts`)
- Tailwind CSS 4 + Prettier + ESLint for styling and formatting

## Quick start
1. Install dependencies: `npm install`
2. Create `.env` in the repo root (see below)
3. Start the dev server: `npm run dev` and open http://localhost:3000

## Environment variables
```
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=llm_reader          # optional, defaults to llm_reader
FILE_STORAGE_ROOT=D:\repo\ai-coreader\storage  # absolute path to uploaded files root
```
`FILE_STORAGE_ROOT` must be writable. The app will create subfolders (e.g., `files/`) on startup if they do not exist.

## NPM scripts
- `npm run dev` – run Next.js locally
- `npm run build` – production build
- `npm run start` – start the production server
- `npm run lint` – lint with ESLint
- `npm run format` – format with Prettier (includes Tailwind plugin)

## Features
- Upload plain text `.txt` books (`/upload`) using a client UI + server action pipeline
- Store uploaded file binaries on disk and metadata (name, mime, size, status) in MongoDB
- Library view (`/library`) lists stored books based on metadata
- Shared UI components in `ui/` (buttons, file uploader, grid cards, etc.)

## Project structure (high level)
```
app/               # Next.js routes, layouts, Header/Footer
app/upload/        # Upload page + server actions
app/library/       # Library page backed by Mongo metadata
lib/db/            # Mongo connection + file metadata helpers
lib/files/         # Local storage utilities for uploaded files
ui/                # Reusable UI components
public/            # Static assets
```

## Generate a folder tree (optional helper)
- Cross-platform (via npx, ignores heavy folders):
  ```
  npx tree-cli -l 3 -I "node_modules|.next|.git"
  ```
- Windows PowerShell built-in (no install):
  ```
  Get-ChildItem -Recurse -Depth 3 -Directory -Name
  ```
Use either command from the repo root to visualize the structure; adjust depth as needed.
