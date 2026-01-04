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
	EntityID     primitive.ObjectID `bson:"entityId" json:"entityId"`
	Name         string             `bson:"name" json:"name"`
	Type         string             `bson:"type" json:"type"`
	StartOffsets []int              `bson:"startOffsets" json:"startOffsets"`
}

type BookChunksDoc struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	CreatedAt    time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt    time.Time          `bson:"updatedAt" json:"updatedAt"`
	BookID       primitive.ObjectID `bson:"bookId" json:"bookId"`
	Index        int                `bson:"index" json:"index"`
	StartChar    int                `bson:"startChar" json:"startChar"`
	EndChar      int                `bson:"endChar" json:"endChar"`
	Text         string             `bson:"text" json:"text"`
	LlmProcessed bool               `bson:"llmProcessed" json:"llmProcessed"`
	Entities     []ChunkEntityRef   `bson:"entities,omitempty" json:"entities,omitempty"`
	Chapters     []string           `bson:"chapters,omitempty" json:"chapters,omitempty"`
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
	Description string             `bson:"description,omitempty" json:"description,omitempty"`
	TotalChars  int                `bson:"totalChars" json:"totalChars"`
	TotalChunks int                `bson:"totalChunks" json:"totalChunks"`
	Processed   bool               `bson:"processed" json:"processed"`
	Source      string             `bson:"source" json:"source"`
}

type EntityDescriptionsDoc struct {
	ID                     primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	CreatedAt              time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt              time.Time          `bson:"updatedAt" json:"updatedAt"`
	BookID                 primitive.ObjectID `bson:"bookId" json:"bookId"`
	BookChunkID            primitive.ObjectID `bson:"bookChunkId" json:"bookChunkId"`
	Name                   string             `bson:"name" json:"name"`
	Type                   string             `bson:"type" json:"type"`
	Summary                string             `bson:"summary,omitempty" json:"summary,omitempty"`
	Role                   string             `bson:"role,omitempty" json:"role,omitempty"`
	Traits                 []string           `bson:"traits,omitempty" json:"traits,omitempty"`
	ImportantLocations     []string           `bson:"importantLocations,omitempty" json:"importantLocations,omitempty"`
	ImportantRelationships []string           `bson:"importantRelationships,omitempty" json:"importantRelationships,omitempty"`
}

type FilesDoc struct {
	ID                  primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	CreatedAt           time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt           time.Time          `bson:"updatedAt" json:"updatedAt"`
	OriginalName        string             `bson:"originalName" json:"originalName"`
	MimeType            string             `bson:"mimeType" json:"mimeType"`
	Size                int                `bson:"size" json:"size"`
	StoragePath         string             `bson:"storagePath" json:"storagePath"`
	StorageName         string             `bson:"storageName" json:"storageName"`
	Percentage          float64            `bson:"percentage,omitempty" json:"percentage,omitempty"`
	Status              string             `bson:"status" json:"status"`
	RawErrorMessage     []string           `bson:"rawErrorMessage,omitempty" json:"rawErrorMessage,omitempty"`
	ErrorMessage        string             `bson:"errorMessage,omitempty" json:"errorMessage,omitempty"`
	ProcessingStartedAt time.Time          `bson:"processingStartedAt,omitempty" json:"processingStartedAt,omitempty"`
	ProcessedAt         time.Time          `bson:"processedAt,omitempty" json:"processedAt,omitempty"`
}

type UsersDoc struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	CreatedAt    time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt    time.Time          `bson:"updatedAt" json:"updatedAt"`
	FirstName    string             `bson:"firstName,omitempty" json:"firstName,omitempty"`
	LastName     string             `bson:"lastName,omitempty" json:"lastName,omitempty"`
	Email        string             `bson:"email" json:"email"`
	PasswordHash string             `bson:"passwordHash" json:"passwordHash"`
}
