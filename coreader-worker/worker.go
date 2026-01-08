package main

import "coreader-worker/llm"

type Worker struct {
	db           *DB
	llmClient    llm.LLMClient
	qdrantClient *QdrantClient
}

func NewWorker(db *DB, llmClient llm.LLMClient, qdrantClient *QdrantClient) *Worker {
	return &Worker{
		db:           db,
		llmClient:    llmClient,
		qdrantClient: qdrantClient,
	}
}
