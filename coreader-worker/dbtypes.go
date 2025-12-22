package main

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type BaseDoc struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt time.Time          `bson:"updatedAt" json:"updatedAt"`
}

type FileStatus string

const (
	FileStatusPending    FileStatus = "pending"
	FileStatusProcessing FileStatus = "processing"
	FileStatusProcessed  FileStatus = "processed"
	FileStatusFailed     FileStatus = "failed"
)

type FileDocCollection struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	CreatedAt    time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt    time.Time          `bson:"updatedAt" json:"updatedAt"`
	OriginalName string             `bson:"originalName" json:"originalName"`
	MimeType     string             `bson:"mimeType" json:"mimeType"`
	Size         int64              `bson:"size" json:"size"`
	StoragePath  string             `bson:"storagePath" json:"storagePath"`
	StorageName  string             `bson:"storageName" json:"storageName"`
	Status       FileStatus         `bson:"status" json:"status"`
}

func (f *FileDocCollection) GetBaseDoc() *BaseDoc {
	return &BaseDoc{
		ID:        f.ID,
		CreatedAt: f.CreatedAt,
		UpdatedAt: f.UpdatedAt,
	}
}

type BookDoc struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	CreatedAt   time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time          `bson:"updatedAt" json:"updatedAt"`
	FileID      primitive.ObjectID `bson:"fileId" json:"fileId"` // reference to FileDocCollection
	Title       string             `bson:"title,omitempty" json:"title,omitempty"`
	Author      string             `bson:"author,omitempty" json:"author,omitempty"`
	Publisher   string             `bson:"publisher,omitempty" json:"publisher,omitempty"`
	Year        string             `bson:"year,omitempty" json:"year,omitempty"`
	Genre       string             `bson:"genre,omitempty" json:"genre,omitempty"`
	TotalChars  int                `bson:"totalChars" json:"totalChars"`
	TotalChunks int                `bson:"totalChunks" json:"totalChunks"`
	Finished    bool               `bson:"finished" json:"finished"`
	Source      string             `bson:"source,omitempty" json:"source,omitempty"` // e.g., "user_upload", "shop", etc.
}

func (b *BookDoc) GetBaseDoc() *BaseDoc {
	return &BaseDoc{
		ID:        b.ID,
		CreatedAt: b.CreatedAt,
		UpdatedAt: b.UpdatedAt,
	}
}

type ChunkEntityRef struct {
	TempName                string `bson:"tempName" json:"tempName"`
	Type                    string `bson:"type" json:"type"`
	StartOffset             int    `bson:"startOffset" json:"startOffset"` // relative to chunk.Text
	EndOffset               int    `bson:"endOffset" json:"endOffset"`
	IsIntroducedInThisChunk bool   `bson:"isIntroducedInThisChunk" json:"isIntroducedInThisChunk"`
}

type ChunkLLMMetadata struct {
	Entities        []ChunkEntityRef `bson:"entities,omitempty" json:"entities,omitempty"`
	HasChapterStart bool             `bson:"hasChapterStart,omitempty" json:"hasChapterStart,omitempty"`
	ChapterTitle    string           `bson:"chapterTitle,omitempty" json:"chapterTitle,omitempty"`
	ChapterNumber   string           `bson:"chapterNumber,omitempty" json:"chapterNumber,omitempty"`
}

type BookChunkDoc struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	CreatedAt    time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt    time.Time          `bson:"updatedAt" json:"updatedAt"`
	BookID       primitive.ObjectID `bson:"bookId" json:"bookId"`
	Index        int                `bson:"index" json:"index"` // 0-based in book order
	StartChar    int                `bson:"startChar" json:"startChar"`
	EndChar      int                `bson:"endChar" json:"endChar"` // exclusive
	Text         string             `bson:"text" json:"text"`
	LLMProcessed bool               `bson:"llmProcessed" json:"llmProcessed"`
	LLMMetadata  *ChunkLLMMetadata  `bson:"llmMetadata,omitempty" json:"llmMetadata,omitempty"`
}

func (b *BookChunkDoc) GetBaseDoc() *BaseDoc {
	return &BaseDoc{
		ID:        b.ID,
		CreatedAt: b.CreatedAt,
		UpdatedAt: b.UpdatedAt,
	}
}

type EntityDescriptionDoc struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt time.Time          `bson:"updatedAt" json:"updatedAt"`
	BookID    primitive.ObjectID `bson:"bookId" json:"bookId"`
	EntityID  primitive.ObjectID `bson:"entityId" json:"entityId"` // if you have a BookEntityDoc, link to it
	Name      string             `bson:"name" json:"name"`
	Type      string             `bson:"type" json:"type"` // "character", "place", "spell", etc.

	// LLM-generated info (all from the model)
	Summary                string   `bson:"summary" json:"summary"`
	Role                   string   `bson:"role,omitempty" json:"role,omitempty"`
	Traits                 []string `bson:"traits,omitempty" json:"traits,omitempty"`
	ImportantLocations     []string `bson:"importantLocations,omitempty" json:"importantLocations,omitempty"`
	ImportantRelationships []string `bson:"importantRelationships,omitempty" json:"importantRelationships,omitempty"`
}

func (e *EntityDescriptionDoc) GetBaseDoc() *BaseDoc {
	return &BaseDoc{
		ID:        e.ID,
		CreatedAt: e.CreatedAt,
		UpdatedAt: e.UpdatedAt,
	}
}

type HasBaseDoc interface {
	GetBaseDoc() *BaseDoc
}
