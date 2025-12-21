package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

func query(coll *mongo.Collection, filter interface{}, result interface{}) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	cur, err := coll.Find(ctx, filter)
	if err != nil {
		return err
	}
	defer cur.Close(ctx)
	return cur.All(ctx, result)
}

type DB struct {
	Client                  *mongo.Client
	LLMDatabase             *mongo.Database
	FilesCollection         *mongo.Collection
	BookDocsCollection      *mongo.Collection
	BookChunkDocsCollection *mongo.Collection
}

const (
	FilesCollectionName         = "files"
	BookDocsCollectionName      = "bookDocs"
	BookChunkDocsCollectionName = "bookChunks"
)

func InitDB() *DB {
	MONGODB_URI := GetEnvWithPanic("MONGODB_URI")

	clientOptions := options.Client().ApplyURI(MONGODB_URI)
	client, err := mongo.Connect(context.TODO(), clientOptions)
	if err != nil {
		panic(err)
	}
	if err = client.Ping(context.TODO(), readpref.Primary()); err != nil {
		log.Panic(err)
	}

	log.Println("Connected to MongoDB!")

	MONGODB_DB_NAME := GetEnvWithPanic("MONGODB_DB_NAME")
	llmDatabase := client.Database(MONGODB_DB_NAME)
	filesCollection := llmDatabase.Collection(FilesCollectionName)
	bookDocsCollection := llmDatabase.Collection(BookDocsCollectionName)
	bookChunkDocsCollection := llmDatabase.Collection(BookChunkDocsCollectionName)
	return &DB{
		Client:                  client,
		LLMDatabase:             llmDatabase,
		FilesCollection:         filesCollection,
		BookDocsCollection:      bookDocsCollection,
		BookChunkDocsCollection: bookChunkDocsCollection,
	}
}

func (db *DB) Close() {
	db.Client.Disconnect(context.TODO())
}

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
	BaseDoc `bson:",inline" json:",inline"`

	OriginalName string     `bson:"originalName" json:"originalName"`
	MimeType     string     `bson:"mimeType" json:"mimeType"`
	Size         int64      `bson:"size" json:"size"`
	StoragePath  string     `bson:"storagePath" json:"storagePath"`
	StorageName  string     `bson:"storageName" json:"storageName"`
	Status       FileStatus `bson:"status" json:"status"`
}

func (f *FileDocCollection) GetBaseDoc() *BaseDoc {
	return &f.BaseDoc
}

type BookDoc struct {
	BaseDoc     `bson:",inline" json:",inline"`
	FileID      primitive.ObjectID `bson:"fileId" json:"fileId"` // reference to FileDocCollection
	Title       string             `bson:"title,omitempty" json:"title,omitempty"`
	Author      string             `bson:"author,omitempty" json:"author,omitempty"`
	TotalChars  int                `bson:"totalChars" json:"totalChars"`
	TotalChunks int                `bson:"totalChunks" json:"totalChunks"`
	LastError   string             `bson:"lastError,omitempty" json:"lastError,omitempty"`
}

func (b *BookDoc) GetBaseDoc() *BaseDoc {
	return &b.BaseDoc
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
	BaseDoc      `bson:",inline" json:",inline"`
	BookID       primitive.ObjectID `bson:"bookId" json:"bookId"`
	Index        int                `bson:"index" json:"index"` // 0-based in book order
	StartChar    int                `bson:"startChar" json:"startChar"`
	EndChar      int                `bson:"endChar" json:"endChar"` // exclusive
	Text         string             `bson:"text" json:"text"`
	LLMProcessed bool               `bson:"llmProcessed" json:"llmProcessed"`
	LLMMetadata  *ChunkLLMMetadata  `bson:"llmMetadata,omitempty" json:"llmMetadata,omitempty"`
}

func (b *BookChunkDoc) GetBaseDoc() *BaseDoc {
	return &b.BaseDoc
}

type EntityDescriptionDoc struct {
	BaseDoc  `bson:",inline" json:",inline"`
	BookID   primitive.ObjectID `bson:"bookId" json:"bookId"`
	EntityID primitive.ObjectID `bson:"entityId" json:"entityId"` // if you have a BookEntityDoc, link to it
	Name     string             `bson:"name" json:"name"`
	Type     string             `bson:"type" json:"type"` // "character", "place", "spell", etc.

	// LLM-generated info (all from the model)
	Summary                string   `bson:"summary" json:"summary"`
	Role                   string   `bson:"role,omitempty" json:"role,omitempty"`
	Traits                 []string `bson:"traits,omitempty" json:"traits,omitempty"`
	ImportantLocations     []string `bson:"importantLocations,omitempty" json:"importantLocations,omitempty"`
	ImportantRelationships []string `bson:"importantRelationships,omitempty" json:"importantRelationships,omitempty"`
}

func (e *EntityDescriptionDoc) GetBaseDoc() *BaseDoc {
	return &e.BaseDoc
}

// todo: Subscribe to changes in the files collection to process new files
func WatchFilesCollectionChanges() {
	// todo
}

type HasBaseDoc interface {
	GetBaseDoc() *BaseDoc
}

func InsertOneWithMeta[T HasBaseDoc](ctx context.Context, coll *mongo.Collection, doc T) (T, error) {
	now := time.Now().UTC()

	base := doc.GetBaseDoc()
	if base.CreatedAt.IsZero() {
		base.CreatedAt = now
	}
	base.UpdatedAt = now

	res, err := coll.InsertOne(ctx, doc)
	if err != nil {
		return doc, err
	}

	if oid, ok := res.InsertedID.(primitive.ObjectID); ok {
		base.ID = oid
	}

	return doc, nil
}

func UpdateOneWithMeta(ctx context.Context, coll *mongo.Collection, Id primitive.ObjectID, update bson.M) (*mongo.UpdateResult, error) {
	update["updatedAt"] = time.Now().UTC()

	return coll.UpdateOne(ctx, bson.D{{Key: "_id", Value: Id}}, bson.D{{Key: "$set", Value: update}})
}

func (db *DB) GetUnprocessedFiles() ([]FileDocCollection, error) {
	var files []FileDocCollection
	filter := bson.D{
		{
			Key: "$or", Value: bson.A{
				bson.D{{Key: "status", Value: FileStatusPending}},
				bson.D{{Key: "status", Value: FileStatusProcessing}},
			},
		},
	}
	err := query(db.FilesCollection, filter, &files)
	fmt.Printf("Found %d unprocessed files", len(files))
	return files, err
}

func (db *DB) SetFileStatus(fileID primitive.ObjectID, status FileStatus) error {
	_, err := UpdateOneWithMeta(context.TODO(), db.FilesCollection, fileID, bson.M{"status": status})
	return err
}

func (db *DB) CreateBookDoc(book *BookDoc) (*BookDoc, error) {
	fmt.Printf("Creating BookDoc %+v\n", book)
	book, err := InsertOneWithMeta(context.TODO(), db.BookDocsCollection, book)
	return book, err
}

func (db *DB) UpdateBookDoc(bookID primitive.ObjectID, updateFields bson.M) (*mongo.UpdateResult, error) {
	return UpdateOneWithMeta(context.TODO(), db.BookDocsCollection, bookID, updateFields)
}

func (db *DB) CreateBookChunkDoc(chunk *BookChunkDoc) (*BookChunkDoc, error) {
	fmt.Printf("Creating BookChunkDoc with index %d, startChar %d, endChar %d\n", chunk.Index, chunk.StartChar, chunk.EndChar)
	chunk, err := InsertOneWithMeta(context.TODO(), db.BookChunkDocsCollection, chunk)
	return chunk, err
}

func (db *DB) AddLLMMetadataToBookChunk(chunkID primitive.ObjectID, llmMetadata *ChunkLLMMetadata) (*mongo.UpdateResult, error) {
	updateFields := bson.M{
		"llmProcessed": true,
		"llmMetadata":  llmMetadata,
	}
	return UpdateOneWithMeta(context.TODO(), db.BookChunkDocsCollection, chunkID, updateFields)
}

func (db *DB) CreateEntityDescriptionDoc(entityDesc *EntityDescriptionDoc) (*EntityDescriptionDoc, error) {
	entityDesc, err := InsertOneWithMeta(context.TODO(), db.LLMDatabase.Collection("entityDescriptions"), entityDesc)
	return entityDesc, err
}
