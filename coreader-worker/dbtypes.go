/*
This file was automatically generated.

Do not modify it by hand
*/

package main

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

type ChunkEntityRef struct {
	TempName                string `bson:"tempName" json:"tempName"`
	Type                    string `bson:"type" json:"type"`
	StartOffset             int    `bson:"startOffset" json:"startOffset"`
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
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	CreatedAt    time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt    time.Time          `bson:"updatedAt" json:"updatedAt"`
	BookID       primitive.ObjectID `bson:"bookId" json:"bookId"`
	Index        int                `bson:"index" json:"index"`
	StartChar    int                `bson:"startChar" json:"startChar"`
	EndChar      int                `bson:"endChar" json:"endChar"`
	Text         string             `bson:"text" json:"text"`
	LlmProcessed bool               `bson:"llmProcessed" json:"llmProcessed"`
	LlmMetadata  *ChunkLLMMetadata  `bson:"llmMetadata,omitempty" json:"llmMetadata,omitempty"`
}

type BooksDoc struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	CreatedAt   time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time          `bson:"updatedAt" json:"updatedAt"`
	FileID      primitive.ObjectID `bson:"fileId" json:"fileId"`
	Title       string             `bson:"title,omitempty" json:"title,omitempty"`
	Author      string             `bson:"author,omitempty" json:"author,omitempty"`
	Publisher   string             `bson:"publisher,omitempty" json:"publisher,omitempty"`
	Year        string             `bson:"year,omitempty" json:"year,omitempty"`
	Genre       string             `bson:"genre,omitempty" json:"genre,omitempty"`
	TotalChars  int                `bson:"totalChars" json:"totalChars"`
	TotalChunks int                `bson:"totalChunks" json:"totalChunks"`
	Finished    bool               `bson:"finished" json:"finished"`
	Source      string             `bson:"source" json:"source"`
}

type EntityDescriptionDoc struct {
	ID                     primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	CreatedAt              time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt              time.Time          `bson:"updatedAt" json:"updatedAt"`
	BookID                 primitive.ObjectID `bson:"bookId" json:"bookId"`
	Name                   string             `bson:"name" json:"name"`
	Type                   string             `bson:"type" json:"type"`
	Summary                string             `bson:"summary" json:"summary"`
	Role                   string             `bson:"role,omitempty" json:"role,omitempty"`
	Traits                 []string           `bson:"traits,omitempty" json:"traits,omitempty"`
	ImportantLocations     []string           `bson:"importantLocations,omitempty" json:"importantLocations,omitempty"`
	ImportantRelationships []string           `bson:"importantRelationships,omitempty" json:"importantRelationships,omitempty"`
}

type FilesDoc struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	CreatedAt    time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt    time.Time          `bson:"updatedAt" json:"updatedAt"`
	OriginalName string             `bson:"originalName" json:"originalName"`
	MimeType     string             `bson:"mimeType" json:"mimeType"`
	Size         int                `bson:"size" json:"size"`
	StoragePath  string             `bson:"storagePath" json:"storagePath"`
	StorageName  string             `bson:"storageName" json:"storageName"`
	Status       string             `bson:"status" json:"status"`
}
