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
  - PowerShell: `pwsh ./scripts/dev.ps1`
  - Bash: `bash ./scripts/dev.sh`
  - Stop infra when done: `docker compose -f infra/docker-compose.yaml --profile infra down`
- Full dockerized stack (app + worker + Mongo + LLM):
  - Start: `pwsh ./scripts/up-docker.ps1` or `bash ./scripts/up-docker.sh`
  - Stop: `pwsh ./scripts/up-docker.ps1 -Down` or `bash ./scripts/up-docker.sh --down`

## Ports
- App: http://localhost:3000
- MongoDB: mongodb://localhost:27017
- LLM (Ollama): http://localhost:11434
