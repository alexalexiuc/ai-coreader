# Semantic analysis and embeddings

## Scope of "semantic analysis" in this repository

In this codebase, semantic analysis refers to persisted machine-readable representations derived from the raw text. Two mechanisms are implemented:

- LLM completion calls that convert each chunk into structured annotations (entities and chapter headings) stored in MongoDB (`coreader-worker/llm/helpers.go`, `coreader-worker/process_file.go`).
- Embedding generation per chunk and persistence to a vector database (Qdrant) (`coreader-worker/llm/ollama.go`, `coreader-worker/qdrant.go`).

The repository implements the write path (create and store annotations/embeddings during ingestion). The web application does not include evidence of a vector retrieval path. The reader UI implements lexical search within the current page by scanning the rendered blocks (`coreader-app/app/reader/[bookId]/ReaderClientPage.tsx`).

## Embedding generation: where and how

### Worker-side embedding calls

Embeddings are generated in the worker, inside the per-chunk processing loop (`coreader-worker/process_file.go`). For each logical chunk, the worker calls:

- `llm.GenerateEmbedding(ctx, w.llmClient, logicalChunk.Text)` (`coreader-worker/llm/helpers.go`), which delegates to `LLMClient.GenerateEmbedding`.

In the Ollama implementation (`coreader-worker/llm/ollama.go`), embedding generation uses Ollama's embed endpoint:

- Embedding model is selected by `OLLAMA_EMBEDDING_MODEL`, defaulting to `nomic-embed-text`.
- The request uses `api.EmbedRequest{ Model: embeddingModel, Input: text }`.
- The response embedding is converted from `[]float64` to `[]float32` for Qdrant compatibility.

The worker currently generates embeddings for every chunk unconditionally and treats failures as fatal for the file processing job (it returns an error and marks the file `failed`).

### Model provisioning in infrastructure

The Docker compose configuration starts an Ollama container and runs an entrypoint script that pulls:

- A generation model (`phi4-mini`).
- An embedding model (`nomic-embed-text`).

This behavior is defined in `infra/ollama-entrypoint.sh` and wired into `infra/docker-compose.yaml`.

An implementation nuance is that the worker's default generation model constant is `phi3:mini` (`coreader-worker/llm/ollama.go`), while the infra script pulls `phi4-mini`. The effective model choice therefore depends on environment configuration (`OLLAMA_MODEL`).

## Embedding persistence: Qdrant collections, IDs, and payload

The worker initializes a Qdrant client (`InitQdrant` in `coreader-worker/qdrant.go`) with configuration:

- `QDRANT_HOST` (default `localhost`), `QDRANT_PORT` (default `6334`, gRPC), and `QDRANT_VECTOR_DIMENSION` (default `768`).
- Cosine distance metric, vector size = `QDRANT_VECTOR_DIMENSION`.

The worker ensures collections exist:

- `book_chunks` (used for chunk embeddings).
- `entities` (created as a placeholder for future use).

Embeddings are written via `StoreChunkEmbedding`, which constructs a `PointStruct` with:

- A numeric point ID derived from the chunk's Mongo `ObjectID` by XOR-ing bytes of the hex string into a numeric value.
- Vector = the embedding values.
- Payload = `{ bookId, chunkId, chunkIndex }` with string IDs for mapping.

The payload fields allow mapping from vector hits back to MongoDB (`books-chunks`) and to a chunk index that is compatible with reader navigation. The repository does not include a Qdrant query path, so this mapping is not exercised in the current UI.

## Tradeoffs and constraints visible in the implementation

### Chunk size and retrieval granularity

Chunks are approximately 1500 characters and cut on heuristic boundaries. This choice affects embeddings and any future semantic retrieval:

- Larger chunks may capture more context, improving semantic similarity for broad queries, but reduce localization precision.
- Smaller chunks improve navigational precision but may degrade semantic coherence and increase index size and processing time.

The worker currently uses a fixed chunking strategy; it does not adapt chunk size based on document structure or token length.

### Consistency between MongoDB and Qdrant

The worker stores embeddings in Qdrant as a side effect of processing chunks. The repository does not show deletion or update workflows that keep Qdrant consistent when MongoDB documents are deleted, reprocessed, or replaced. This is relevant for long-term experiments and evaluation: stale vectors can bias retrieval results unless cleaned up.

### Provider support constraints

The worker supports `AI_CLIENT=openai`, but `GenerateEmbedding` for that provider path returns an error ("embedding generation not supported"), implying that embeddings (and thus vector indexing) currently require the Ollama client (`coreader-worker/llm/aiProvider.go`). This narrows reproducibility of semantic features.

## Repository evidence

- `coreader-worker/process_file.go`
- `coreader-worker/llm/helpers.go`
- `coreader-worker/llm/ollama.go`
- `coreader-worker/llm/aiProvider.go`
- `coreader-worker/qdrant.go`
- `infra/docker-compose.yaml`
- `infra/ollama-entrypoint.sh`
- `coreader-app/app/reader/[bookId]/ReaderClientPage.tsx`

## Open questions / assumptions

- The system stores embeddings but does not expose a retrieval API in the inspected code. It is unclear whether semantic search is intentionally deferred or implemented elsewhere not captured in the repository.
- Qdrant query behavior (including filtering by `bookId` via payload) is not implemented in `coreader-app/` in the inspected code. Any claims about semantic search should be deferred until a retrieval path exists.
- There is no explicit evidence of re-embedding strategies when a chunk changes (e.g., reprocessing after edits). Since source documents are static uploads, this may be acceptable, but it is an assumption.
