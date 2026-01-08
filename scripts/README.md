# Dev scripts

Run from repo root.

- `scripts/dev.ps1` / `scripts/dev.sh`: start MongoDB + LLM + Qdrant via Docker Compose (infra profile) and stop any running dockerized stack to avoid duplicates, then launch Next.js (`npm run dev`) and the Go worker (`go run .`). The PowerShell script opens compose logs in a separate window (no `-d`); stop infra with Ctrl+C there or `docker compose -f infra/docker-compose.yaml --profile infra down`. Run with `powershell -File ./scripts/dev.ps1` (or `pwsh` if available).
- `scripts/up-docker.ps1` / `scripts/up-docker.sh`: fully dockerized stack (app + worker + mongo + LLM + Qdrant) via compose `stack` profile. Add `-Down` (PS) or `--down` (bash) to stop.
- `scripts/reset-infra.ps1` / `scripts/reset-infra.sh`: reset infrastructure data. By default resets all data (MongoDB, Qdrant). Use `--mongo` or `--qdrant` flags to reset specific services only.

Requirements: Docker with Compose plugin, Node 20+, npm, Go 1.22+ for host-mode dev.
