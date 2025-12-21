#!/usr/bin/env bash
set -euo pipefail

# Starts or stops the fully dockerized stack (app + worker + Mongo + LLM) using the compose stack profile.

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="$repo_root/infra/docker-compose.yaml"

if [[ "${1-}" == "--down" ]]; then
  echo "Stopping dockerized stack..."
  docker compose -f "$compose_file" --profile stack down
  exit 0
fi

echo "Building and starting dockerized stack..."
docker compose -f "$compose_file" --profile stack up -d --build --remove-orphans

echo
echo "Stack is starting. Check status with:"
echo "  docker compose -f \"$compose_file\" --profile stack ps"
echo "App: http://localhost:3000"
echo "LLM: http://localhost:11434"
echo "Mongo: mongodb://localhost:27017"
