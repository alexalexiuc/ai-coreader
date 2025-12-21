#!/usr/bin/env bash
set -euo pipefail

# Starts dev stack on host: Mongo + LLM via Docker Compose, then Next.js and Go worker locally.

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="$repo_root/infra/docker-compose.yaml"

echo "Ensuring dockerized app/worker stack is stopped to avoid duplicates..."
docker compose -f "$compose_file" --profile stack down >/dev/null 2>&1 || true

echo "Starting MongoDB + LLM containers..."
docker compose -f "$compose_file" --profile infra up -d --remove-orphans

pids=()

start_proc() {
  local name="$1" workdir="$2"
  shift 2
  echo "Launching ${name}..."
  (cd "$workdir" && "$@") &
  pids+=("$!")
}

cleanup() {
  echo "Stopping app processes..."
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT

start_proc "Next.js dev server" "$repo_root/coreader-app" npm run dev
start_proc "Go worker" "$repo_root/coreader-worker" go run .

echo
echo "Dev services started:"
echo "  - MongoDB + LLM containers: docker compose -f \"$compose_file\" --profile infra ps"
echo "  - Next.js: http://localhost:3000"
echo "  - LLM: http://localhost:11434"
echo
echo "Stop infra when done: docker compose -f \"$compose_file\" --profile infra down"
