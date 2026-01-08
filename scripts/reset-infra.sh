#!/usr/bin/env bash
set -euo pipefail

# Reset script for AI CoReader infrastructure
# Optionally wipes MongoDB and/or Qdrant data

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="$repo_root/infra/docker-compose.yaml"
storage_dir="$repo_root/storage"

usage() {
  cat <<EOF
Usage: $0 [OPTIONS]

Reset infrastructure data for AI CoReader.

OPTIONS:
  --mongo         Reset MongoDB data only
  --qdrant        Reset Qdrant data only
  --all           Reset all data (MongoDB, Qdrant) [default]
  --help          Show this help message

EXAMPLES:
  $0 --all        # Reset all data
  $0 --qdrant     # Reset only Qdrant data
  $0 --mongo      # Reset only MongoDB data
EOF
}

reset_mongo=false
reset_qdrant=false

# Parse arguments
if [ $# -eq 0 ]; then
  # Default: reset all
  reset_mongo=true
  reset_qdrant=true
else
  while [ $# -gt 0 ]; do
    case "$1" in
      --mongo)
        reset_mongo=true
        ;;
      --qdrant)
        reset_qdrant=true
        ;;
      --all)
        reset_mongo=true
        reset_qdrant=true
        ;;
      --help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown option: $1"
        usage
        exit 1
        ;;
    esac
    shift
  done
fi

echo "AI CoReader Infrastructure Reset"
echo "================================="
echo

# Stop all containers first
echo "Stopping all containers..."
docker compose -f "$compose_file" --profile infra down 2>/dev/null || true
docker compose -f "$compose_file" --profile stack down 2>/dev/null || true

if [ "$reset_mongo" = true ]; then
  echo
  echo "Resetting MongoDB data..."
  if [ -d "$storage_dir/mongo" ]; then
    rm -rf "$storage_dir/mongo"
    echo "  ✓ MongoDB data removed"
  else
    echo "  ℹ MongoDB data directory does not exist"
  fi
fi

if [ "$reset_qdrant" = true ]; then
  echo
  echo "Resetting Qdrant data..."
  if [ -d "$storage_dir/qdrant" ]; then
    rm -rf "$storage_dir/qdrant"
    echo "  ✓ Qdrant data removed"
  else
    echo "  ℹ Qdrant data directory does not exist"
  fi
fi

echo
echo "================================="
echo "Reset complete!"
echo
echo "To start services again:"
echo "  - Dev mode (host): bash ./scripts/dev.sh"
echo "  - Docker stack: bash ./scripts/up-docker.sh"
