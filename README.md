# ai-coreader

Dev-friendly setup for the Next.js app, Go worker, and local infra (MongoDB + LLM via Ollama).

## Layout
- `coreader-app/` — Next.js frontend.
- `coreader-worker/` — Go worker.
- `infra/` — Docker Compose for MongoDB, LLM, and optional app/worker containers.
- `scripts/` — helper scripts for dev and full docker runs.

## Prerequisites
- Docker with Compose plugin (for infra and dockerized stack).
- Node 20+ and npm (host dev for Next.js).
- Go 1.22+ (host dev for worker).

## Quick start
- Host dev (Mongo + LLM in Docker, apps on host):
  - PowerShell: `powershell -File ./scripts/dev.ps1` (or `pwsh ./scripts/dev.ps1` if you have PowerShell 7)
  - Bash: `bash ./scripts/dev.sh`
  - Stop infra when done: `docker compose -f infra/docker-compose.yaml --profile infra down`
- Full dockerized stack (app + worker + Mongo + LLM):
  - Start: `pwsh ./scripts/up-docker.ps1` or `bash ./scripts/up-docker.sh`
  - Stop: `pwsh ./scripts/up-docker.ps1 -Down` or `bash ./scripts/up-docker.sh --down`

## Root npm scripts (entrypoint) ✅
We added a lightweight npm project at the repository root to make starting development and the full stack simple with npm commands.

Useful commands:

- `npm run dev` — Cross-platform helper that runs the dev flow (starts infra containers for Mongo & LLM, then runs Next.js and the Go worker locally). On Windows it uses PowerShell, on Unix it uses bash.
- `npm run docker:up` — Launch full dockerized stack (app + worker + infra) using `./scripts/up-docker.sh`.
- `npm run docker:down` — Stop the dockerized stack.
- `npm run app:dev` — Start only the Next.js dev server (`coreader-app`).
- `npm run app:start` — Start Next.js in production mode (uses `coreader-app` start script).
- `npm run worker:run` — Run the Go worker locally (requires Go installed).
- `npm run lint` / `npm run format` — Lint/format the frontend via `coreader-app` scripts.

> Tip: Run `npm run help` to print a short summary of available root scripts.


## Ports
- App: http://localhost:3000
- MongoDB: mongodb://localhost:27017
- LLM (Ollama): http://localhost:11434
- Qdrant: http://localhost:6333 (HTTP API), localhost:6334 (gRPC API)
