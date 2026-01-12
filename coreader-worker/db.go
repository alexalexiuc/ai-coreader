package main

import (
	"context"
	"coreader-worker/llm"
	utils "coreader-worker/utils"
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
	GetCreatedAt() time.Time
	SetCreatedAt(time.Time)
	SetUpdatedAt(time.Time)
	SetDocID(primitive.ObjectID)
}

func (f *FilesDoc) GetCreatedAt() time.Time  { return f.CreatedAt }
func (f *FilesDoc) SetCreatedAt(t time.Time) { f.CreatedAt = t }
func (f *FilesDoc) SetUpdatedAt(t time.Time) { f.UpdatedAt = t }
func (f *FilesDoc) SetDocID(id primitive.ObjectID) {
	f.ID = id
}

func (b *BooksDoc) GetCreatedAt() time.Time  { return b.CreatedAt }
func (b *BooksDoc) SetCreatedAt(t time.Time) { b.CreatedAt = t }
func (b *BooksDoc) SetUpdatedAt(t time.Time) { b.UpdatedAt = t }
func (b *BooksDoc) SetDocID(id primitive.ObjectID) {
	b.ID = id
}

func (b *BookChunksDoc) GetCreatedAt() time.Time  { return b.CreatedAt }
func (b *BookChunksDoc) SetCreatedAt(t time.Time) { b.CreatedAt = t }
func (b *BookChunksDoc) SetUpdatedAt(t time.Time) { b.UpdatedAt = t }
func (b *BookChunksDoc) SetDocID(id primitive.ObjectID) {
	b.ID = id
}

func (u *UserBooksDoc) GetCreatedAt() time.Time  { return u.CreatedAt }
func (u *UserBooksDoc) SetCreatedAt(t time.Time) { u.CreatedAt = t }
func (u *UserBooksDoc) SetUpdatedAt(t time.Time) { u.UpdatedAt = t }
func (u *UserBooksDoc) SetDocID(id primitive.ObjectID) {
	u.ID = id
}

func (e *EntitiesDoc) GetCreatedAt() time.Time  { return e.CreatedAt }
func (e *EntitiesDoc) SetCreatedAt(t time.Time) { e.CreatedAt = t }
func (e *EntitiesDoc) SetUpdatedAt(t time.Time) { e.UpdatedAt = t }
func (e *EntitiesDoc) SetDocID(id primitive.ObjectID) {
	e.ID = id
}

func (e *EntityMentionsDoc) GetCreatedAt() time.Time  { return e.CreatedAt }
func (e *EntityMentionsDoc) SetCreatedAt(t time.Time) { e.CreatedAt = t }
func (e *EntityMentionsDoc) SetUpdatedAt(t time.Time) { e.UpdatedAt = t }
func (e *EntityMentionsDoc) SetDocID(id primitive.ObjectID) {
	e.ID = id
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
	Client                   *mongo.Client
	LLMDatabase              *mongo.Database
	FilesCollection          *mongo.Collection
	BooksCollection          *mongo.Collection
	BooksChunksCollection    *mongo.Collection
	EntitiesCollection       *mongo.Collection
	EntityMentionsCollection *mongo.Collection
	UsersCollection          *mongo.Collection
	UserBooksCollection      *mongo.Collection
}

const (
	FilesCollectionName          = "files"
	BooksCollectionName          = "books"
	BooksChunksCollectionName    = "books-chunks"
	EntitiesCollectionName       = "entities"
	EntityMentionsCollectionName = "entity-mentions"
	UsersCollectionName          = "users"
	UserBooksCollectionName      = "user-books"
)

func InitDB() *DB {
	MONGODB_URI := utils.GetEnvWithPanic("MONGODB_URI")

	clientOptions := options.Client().ApplyURI(MONGODB_URI)
	client, err := mongo.Connect(context.TODO(), clientOptions)
	if err != nil {
		panic(err)
	}
	if err = client.Ping(context.TODO(), readpref.Primary()); err != nil {
		log.Panic(err)
	}

	log.Println("Connected to MongoDB!")

	MONGODB_DB_NAME := utils.GetEnvWithPanic("MONGODB_DB_NAME")
	llmDatabase := client.Database(MONGODB_DB_NAME)
	filesCollection := llmDatabase.Collection(FilesCollectionName)
	booksCollection := llmDatabase.Collection(BooksCollectionName)
	booksChunksCollection := llmDatabase.Collection(BooksChunksCollectionName)
	entitiesCollection := llmDatabase.Collection(EntitiesCollectionName)
	entityMentionsCollection := llmDatabase.Collection(EntityMentionsCollectionName)
	usersCollection := llmDatabase.Collection(UsersCollectionName)
	userBooksCollection := llmDatabase.Collection(UserBooksCollectionName)
	return &DB{
		Client:                   client,
		LLMDatabase:              llmDatabase,
		FilesCollection:          filesCollection,
		BooksCollection:          booksCollection,
		BooksChunksCollection:    booksChunksCollection,
		EntitiesCollection:       entitiesCollection,
		EntityMentionsCollection: entityMentionsCollection,
		UsersCollection:          usersCollection,
		UserBooksCollection:      userBooksCollection,
	}
}

func (db *DB) Close() {
	db.Client.Disconnect(context.TODO())
}

func (w *Worker) WatchFilesCollectionChanges(ctx context.Context) {
	// TODO: Replace polling with a more elegant solution (e.g., change streams, message queue, or event-driven architecture)
	log.Println("Polling files collection for pending files...")

	sem := make(chan struct{}, 3) // limit to 3 concurrent file processing
	for {
		if ctx.Err() != nil {
			log.Println("Shutdown signal received; stopping poller.")
			return
		}

		files, err := queryPendingFiles(w.db)
		if err != nil {
			log.Printf("Polling error: %v", err)
		} else {
			for _, file := range files {
				if ctx.Err() != nil {
					log.Println("Shutdown signal received; stopping file processing loop.")
					return
				}

				sem <- struct{}{}
				go func(file FilesDoc) {
					defer func() { <-sem }()
					start := time.Now()
					log.Printf("Processing file: %s (%s)", file.ID.Hex(), file.StoragePath)
					if err := w.ProcessFile(ctx, &file); err != nil {
						log.Printf("Error processing file %s: %v", file.ID.Hex(), err)

					}
					log.Printf("Successfully processed file %s in %s", file.ID.Hex(), time.Since(start))
				}(file)
			}
		}

		select {
		case <-ctx.Done():
			log.Println("Shutdown signal received; stopping poller.")
			return
		case <-time.After(5 * time.Second):
		}
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

	if doc.GetCreatedAt().IsZero() {
		doc.SetCreatedAt(now)
	}
	doc.SetUpdatedAt(now)

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

func (db *DB) SetFileProcessingStarted(fileID primitive.ObjectID) error {
	_, err := UpdateOneWithMeta(context.TODO(), db.FilesCollection, fileID, bson.M{"processingStartedAt": time.Now().UTC(), "status": "processing"})
	return err
}

func (db *DB) SetFileProcessingCompleted(fileID primitive.ObjectID) error {
	_, err := UpdateOneWithMeta(context.TODO(), db.FilesCollection, fileID, bson.M{"processedAt": time.Now().UTC()})
	return err
}

func (db *DB) SetFileError(fileID primitive.ObjectID, rawError string, userMessage string) error {
	_, err := UpdateOneWithMeta(context.TODO(), db.FilesCollection, fileID, bson.M{
		"rawErrorMessage": rawError,
		"errorMessage":    userMessage,
	})
	return err
}

// AppendFileError appends a new error to the rawErrorMessage array and updates errorMessage
func (db *DB) AppendFileError(fileID primitive.ObjectID, rawError string, userMessage string) error {
	update := bson.M{
		"$push": bson.M{"rawErrorMessage": rawError},
		"$set":  bson.M{"errorMessage": userMessage, "updatedAt": time.Now().UTC()},
	}
	_, err := db.FilesCollection.UpdateByID(context.TODO(), fileID, update)
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

func (db *DB) AddLLMDataToBookChunk(chunkID primitive.ObjectID, entities []ChunkEntityRef, llmMetadata *llm.ChunkLLMMetadata) (*mongo.UpdateResult, error) {
	updateFields := bson.M{
		"llmProcessed": true,
		"entities":     entities,
		"chapters":     llmMetadata.Chapters,
	}
	return UpdateOneWithMeta(context.TODO(), db.BooksChunksCollection, chunkID, updateFields)
}

func (db *DB) DeleteBookData(bookID primitive.ObjectID) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Delete from entity collections
	if _, err := db.EntitiesCollection.DeleteMany(ctx, bson.M{"bookId": bookID}); err != nil {
		return err
	}
	if _, err := db.EntityMentionsCollection.DeleteMany(ctx, bson.M{"bookId": bookID}); err != nil {
		return err
	}
	if _, err := db.BooksChunksCollection.DeleteMany(ctx, bson.M{"bookId": bookID}); err != nil {
		return err
	}
	if _, err := db.BooksCollection.DeleteOne(ctx, bson.M{"_id": bookID}); err != nil {
		return err
	}
	return nil
}

// CreateOrUpdateUserBook creates a new user-book link or updates existing one (upsert)
// This establishes ownership and can initialize reading metadata
// Returns the user-book doc and a boolean indicating if it was created (true) or updated (false)
func (db *DB) CreateOrUpdateUserBook(userID primitive.ObjectID, bookID primitive.ObjectID) (*UserBooksDoc, bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	now := time.Now().UTC()
	filter := bson.M{"userId": userID, "bookId": bookID}

	// Check if link already exists
	var existing UserBooksDoc
	err := db.UserBooksCollection.FindOne(ctx, filter).Decode(&existing)

	if err == nil {
		// Link exists, just update the timestamp
		_, err := UpdateOneWithMeta(ctx, db.UserBooksCollection, existing.ID, bson.M{})
		if err != nil {
			return nil, false, err
		}
		return &existing, false, nil
	}

	if err != mongo.ErrNoDocuments {
		return nil, false, err
	}

	// Create new link
	userBook := &UserBooksDoc{
		UserID:    userID,
		BookID:    bookID,
		CreatedAt: now,
		UpdatedAt: now,
	}

	result, err := InsertOneWithMeta(ctx, db.UserBooksCollection, userBook)
	if err != nil {
		return nil, false, err
	}

	return result, true, nil
}

// UpdateChunkEntityID updates the entityId field for a specific entity in a chunk's entities array
func (db *DB) UpdateChunkEntityID(chunkID primitive.ObjectID, entityName, entityType string, entityID primitive.ObjectID) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{
		"_id":           chunkID,
		"entities.name": entityName,
		"entities.type": entityType,
	}

	update := bson.M{
		"$set": bson.M{
			"entities.$[elem].entityId": entityID,
			"updatedAt":                 time.Now().UTC(),
		},
	}

	arrayFilters := options.Update().SetArrayFilters(options.ArrayFilters{
		Filters: []interface{}{
			bson.M{"elem.name": entityName, "elem.type": entityType},
		},
	})

	_, err := db.BooksChunksCollection.UpdateOne(ctx, filter, update, arrayFilters)
	return err
}
