#!/bin/sh
set -e

# start server in background
ollama serve &

# give it a moment to start
sleep 2

# pull phi4-mini model for text generation (ignore errors)
ollama pull phi4-mini || true
# pull nomic-embed-text model for text embedding (ignore errors)
ollama pull nomic-embed-text || true

# GPU check
nvidia-smi

# list models to verify
ollama list

# keep container running (wait for background ollama)
wait
