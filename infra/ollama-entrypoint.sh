#!/bin/sh
set -e

# start server in background
ollama serve &

# give it a moment to start
sleep 2

# pull models you want available
ollama pull phi4-mini || true
# ollama pull llama3.2:3b-instruct || true

# GPU check
nvidia-smi

# list models to verify
ollama list

# keep container running (wait for background ollama)
wait
