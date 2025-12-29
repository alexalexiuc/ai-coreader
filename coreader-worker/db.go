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
	SetDocID(primitive.ObjectID)
}

func (f *FilesDoc) GetBaseDoc() *BaseDoc {
	return &BaseDoc{
		ID:        f.ID,
		CreatedAt: f.CreatedAt,
		UpdatedAt: f.UpdatedAt,
	}
}
func (f *FilesDoc) SetDocID(id primitive.ObjectID) {
	f.ID = id
}

func (b *BooksDoc) GetBaseDoc() *BaseDoc {
	return &BaseDoc{
		ID:        b.ID,
		CreatedAt: b.CreatedAt,
		UpdatedAt: b.UpdatedAt,
	}
}
func (b *BooksDoc) SetDocID(id primitive.ObjectID) {
	b.ID = id
}

func (e *EntityDescriptionsDoc) GetBaseDoc() *BaseDoc {
	return &BaseDoc{
		ID:        e.ID,
		CreatedAt: e.CreatedAt,
		UpdatedAt: e.UpdatedAt,
	}
}

func (e *EntityDescriptionsDoc) SetDocID(id primitive.ObjectID) {
	e.ID = id
}

func (b *BookChunksDoc) GetBaseDoc() *BaseDoc {
	return &BaseDoc{
		ID:        b.ID,
		CreatedAt: b.CreatedAt,
		UpdatedAt: b.UpdatedAt,
	}
}

func (b *BookChunksDoc) SetDocID(id primitive.ObjectID) {
	b.ID = id
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
	Client                       *mongo.Client
	LLMDatabase                  *mongo.Database
	FilesCollection              *mongo.Collection
	BooksCollection              *mongo.Collection
	BooksChunksCollection        *mongo.Collection
	EntityDescriptionsCollection *mongo.Collection
	UsersCollection              *mongo.Collection
}

const (
	FilesCollectionName              = "files"
	BooksCollectionName              = "books"
	BooksChunksCollectionName        = "books-chunks"
	EntityDescriptionsCollectionName = "entity-descriptions"
	UsersCollectionName              = "users"
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
	booksCollection := llmDatabase.Collection(BooksCollectionName)
	booksChunksCollection := llmDatabase.Collection(BooksChunksCollectionName)
	entityDescriptionsCollection := llmDatabase.Collection(EntityDescriptionsCollectionName)
	usersCollection := llmDatabase.Collection(UsersCollectionName)
	return &DB{
		Client:                       client,
		LLMDatabase:                  llmDatabase,
		FilesCollection:              filesCollection,
		BooksCollection:              booksCollection,
		BooksChunksCollection:        booksChunksCollection,
		EntityDescriptionsCollection: entityDescriptionsCollection,
		UsersCollection:              usersCollection,
	}
}

func (db *DB) Close() {
	db.Client.Disconnect(context.TODO())
}

func WatchFilesCollectionChanges(db *DB, llm *LLMClient) {
	// TODO: Replace polling with a more elegant solution (e.g., change streams, message queue, or event-driven architecture)
	log.Println("Polling files collection for pending files...")
	for {
		files, err := queryPendingFiles(db)
		if err != nil {
			log.Printf("Polling error: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}
		for _, file := range files {
			start := time.Now()
			log.Printf("Processing file: %s (%s)", file.ID.Hex(), file.StoragePath)
			if err := ProcessFile(db, &file, llm); err != nil {
				log.Printf("Error processing file %s: %v", file.ID.Hex(), err)
				continue
			}
			log.Printf("Successfully processed file %s in %s", file.ID.Hex(), time.Since(start))
		}
		time.Sleep(5 * time.Second)
	}
}

func queryPendingFiles(db *DB) ([]FilesDoc, error) {
	var files []FilesDoc
	filter := bson.D{{Key: "status", Value: "pending"}}
	err := query(db.FilesCollection, filter, &files)
	return files, err
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
		doc.SetDocID(oid)
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
	fmt.Printf("Found %d unprocessed files\n", len(files))
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
	book, err := InsertOneWithMeta(context.TODO(), db.BooksCollection, book)
	return book, err
}

func (db *DB) UpdateBookDoc(bookID primitive.ObjectID, updateFields bson.M) (*mongo.UpdateResult, error) {
	return UpdateOneWithMeta(context.TODO(), db.BooksCollection, bookID, updateFields)
}

func (db *DB) SetBookProcessed(bookID primitive.ObjectID) (*mongo.UpdateResult, error) {
	return UpdateOneWithMeta(context.TODO(), db.BooksCollection, bookID, bson.M{"processed": true})
}

func (db *DB) CreateBookChunkDoc(chunk *BookChunksDoc) (*BookChunksDoc, error) {
	fmt.Printf("Creating BookChunkDoc with index %d, startChar %d, endChar %d\n", chunk.Index, chunk.StartChar, chunk.EndChar)
	chunk, err := InsertOneWithMeta(context.TODO(), db.BooksChunksCollection, chunk)
	return chunk, err
}

func (db *DB) AddLLMMetadataToBookChunk(chunkID primitive.ObjectID, llmMetadata *ChunkLLMMetadata) (*mongo.UpdateResult, error) {
	updateFields := bson.M{
		"llmProcessed": true,
		"llmMetadata":  llmMetadata,
	}
	return UpdateOneWithMeta(context.TODO(), db.BooksChunksCollection, chunkID, updateFields)
}

func (db *DB) GetEntityByNameAndBook(bookID primitive.ObjectID, name string) (*EntityDescriptionsDoc, error) {
	var entity EntityDescriptionsDoc
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.D{
		{Key: "bookId", Value: bookID},
		{Key: "name", Value: name},
	}

	err := db.LLMDatabase.Collection("entityDescriptions").FindOne(ctx, filter).Decode(&entity)
	if err != nil {
		return nil, err
	}
	return &entity, nil
}

func (db *DB) CreateEntityDescriptionDoc(entityDesc *EntityDescriptionsDoc) (*EntityDescriptionsDoc, error) {
	entityDesc, err := InsertOneWithMeta(context.TODO(), db.LLMDatabase.Collection("entityDescriptions"), entityDesc)
	return entityDesc, err
}
