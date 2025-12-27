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

type BaseDoc struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt time.Time          `bson:"updatedAt" json:"updatedAt"`
}

type HasBaseDoc interface {
	GetBaseDoc() *BaseDoc
}

func (f *FilesDoc) GetBaseDoc() *BaseDoc {
	return &BaseDoc{
		ID:        f.ID,
		CreatedAt: f.CreatedAt,
		UpdatedAt: f.UpdatedAt,
	}
}

func (b *BooksDoc) GetBaseDoc() *BaseDoc {
	return &BaseDoc{
		ID:        b.ID,
		CreatedAt: b.CreatedAt,
		UpdatedAt: b.UpdatedAt,
	}
}

func (e *EntityDescriptionDoc) GetBaseDoc() *BaseDoc {
	return &BaseDoc{
		ID:        e.ID,
		CreatedAt: e.CreatedAt,
		UpdatedAt: e.UpdatedAt,
	}
}

func (b *BookChunkDoc) GetBaseDoc() *BaseDoc {
	return &BaseDoc{
		ID:        b.ID,
		CreatedAt: b.CreatedAt,
		UpdatedAt: b.UpdatedAt,
	}
}

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
	BookDocsCollectionName      = "books"
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

// todo: Subscribe to changes in the files collection to process new files
func WatchFilesCollectionChanges() {
	// todo
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

func (db *DB) GetUnprocessedFiles() ([]FilesDoc, error) {
	var files []FilesDoc
	filter := bson.D{
		{
			Key: "$or", Value: bson.A{
				bson.D{{Key: "status", Value: "pending"}},
				bson.D{{Key: "status", Value: "processing"}},
			},
		},
	}
	err := query(db.FilesCollection, filter, &files)
	fmt.Printf("Found %d unprocessed files", len(files))
	return files, err
}

func (db *DB) SetFileStatus(fileID primitive.ObjectID, status string) error {
	_, err := UpdateOneWithMeta(context.TODO(), db.FilesCollection, fileID, bson.M{"status": status})
	return err
}

func (db *DB) SetFileProgress(fileID primitive.ObjectID, percentage float64) error {
	_, err := UpdateOneWithMeta(context.TODO(), db.FilesCollection, fileID, bson.M{"percentage": percentage})
	return err
}

func (db *DB) CreateBookDoc(book *BooksDoc) (*BooksDoc, error) {
	fmt.Printf("Creating BookDoc %+v\n", book)
	book, err := InsertOneWithMeta(context.TODO(), db.BookDocsCollection, book)
	return book, err
}

func (db *DB) UpdateBookDoc(bookID primitive.ObjectID, updateFields bson.M) (*mongo.UpdateResult, error) {
	return UpdateOneWithMeta(context.TODO(), db.BookDocsCollection, bookID, updateFields)
}

func (db *DB) SetBookProcessed(bookID primitive.ObjectID) (*mongo.UpdateResult, error) {
	return UpdateOneWithMeta(context.TODO(), db.BookDocsCollection, bookID, bson.M{"processed": true})
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
