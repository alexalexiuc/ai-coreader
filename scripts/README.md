# Dev scripts

Run from repo root.

- `scripts/dev.ps1` / `scripts/dev.sh`: start MongoDB + LLM via Docker Compose (infra profile) and stop any running dockerized stack to avoid duplicates, then launch Next.js (`npm run dev`) and the Go worker (`go run .`). Stop infra with `docker compose -f infra/docker-compose.yaml --profile infra down`.
- `scripts/up-docker.ps1` / `scripts/up-docker.sh`: fully dockerized stack (app + worker + mongo + LLM) via compose `stack` profile. Add `-Down` (PS) or `--down` (bash) to stop.

Requirements: Docker with Compose plugin, Node 20+, npm, Go 1.22+ for host-mode dev.
