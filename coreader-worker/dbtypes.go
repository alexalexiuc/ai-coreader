/*
This file was automatically generated.

Do not modify it by hand
*/

package main

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

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

func (f *BooksDoc) GetBaseDoc() *BaseDoc {
	return &BaseDoc{
		ID:        f.ID,
		CreatedAt: f.CreatedAt,
		UpdatedAt: f.UpdatedAt,
	}
}

type FilesDoc struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	CreatedAt    time.Time          `bson:"createdAt" json:"createdAt"`
	MimeType     string             `bson:"mimeType" json:"mimeType"`
	OriginalName string             `bson:"originalName" json:"originalName"`
	Size         int                `bson:"size" json:"size"`
	Status       string             `bson:"status" json:"status"`
	StorageName  string             `bson:"storageName" json:"storageName"`
	StoragePath  string             `bson:"storagePath" json:"storagePath"`
	UpdatedAt    time.Time          `bson:"updatedAt" json:"updatedAt"`
}

func (f *FilesDoc) GetBaseDoc() *BaseDoc {
	return &BaseDoc{
		ID:        f.ID,
		CreatedAt: f.CreatedAt,
		UpdatedAt: f.UpdatedAt,
	}
}
