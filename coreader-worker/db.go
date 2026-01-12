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

func (u *UserBooksDoc) GetBaseDoc() *BaseDoc {
	return &BaseDoc{
		ID:        u.ID,
		CreatedAt: u.CreatedAt,
		UpdatedAt: u.UpdatedAt,
	}
}

func (u *UserBooksDoc) SetDocID(id primitive.ObjectID) {
	u.ID = id
}

func (e *EntitiesDoc) GetBaseDoc() *BaseDoc {
	return &BaseDoc{
		ID:        e.ID,
		CreatedAt: e.CreatedAt,
		UpdatedAt: e.UpdatedAt,
	}
}

func (e *EntitiesDoc) SetDocID(id primitive.ObjectID) {
	e.ID = id
}

func (e *EntityMentionsDoc) GetBaseDoc() *BaseDoc {
	return &BaseDoc{
		ID:        e.ID,
		CreatedAt: e.CreatedAt,
		UpdatedAt: e.UpdatedAt,
	}
}

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
	Client                       *mongo.Client
	LLMDatabase                  *mongo.Database
	FilesCollection              *mongo.Collection
	BooksCollection              *mongo.Collection
	BooksChunksCollection        *mongo.Collection
	EntityDescriptionsCollection *mongo.Collection
	EntitiesCollection           *mongo.Collection
	EntityMentionsCollection     *mongo.Collection
	UsersCollection              *mongo.Collection
	UserBooksCollection          *mongo.Collection
}

const (
	FilesCollectionName              = "files"
	BooksCollectionName              = "books"
	BooksChunksCollectionName        = "books-chunks"
	EntityDescriptionsCollectionName = "entity-descriptions"
	EntitiesCollectionName           = "entities"
	EntityMentionsCollectionName     = "entity-mentions"
	UsersCollectionName              = "users"
	UserBooksCollectionName          = "user-books"
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
	entityDescriptionsCollection := llmDatabase.Collection(EntityDescriptionsCollectionName)
	entitiesCollection := llmDatabase.Collection(EntitiesCollectionName)
	entityMentionsCollection := llmDatabase.Collection(EntityMentionsCollectionName)
	usersCollection := llmDatabase.Collection(UsersCollectionName)
	userBooksCollection := llmDatabase.Collection(UserBooksCollectionName)
	return &DB{
		Client:                       client,
		LLMDatabase:                  llmDatabase,
		FilesCollection:              filesCollection,
		BooksCollection:              booksCollection,
		BooksChunksCollection:        booksChunksCollection,
		EntityDescriptionsCollection: entityDescriptionsCollection,
		EntitiesCollection:           entitiesCollection,
		EntityMentionsCollection:     entityMentionsCollection,
		UsersCollection:              usersCollection,
		UserBooksCollection:          userBooksCollection,
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

func (db *DB) GetEntityByNameAndBook(bookID primitive.ObjectID, name string) (*EntityDescriptionsDoc, error) {
	var entity EntityDescriptionsDoc
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.D{
		{Key: "bookId", Value: bookID},
		{Key: "name", Value: name},
	}

	err := db.EntityDescriptionsCollection.FindOne(ctx, filter).Decode(&entity)
	if err != nil {
		return nil, err
	}
	return &entity, nil
}

func (db *DB) CreateEntityDescriptionDoc(entityDesc *EntityDescriptionsDoc) (*EntityDescriptionsDoc, error) {
	entityDesc, err := InsertOneWithMeta(context.TODO(), db.EntityDescriptionsCollection, entityDesc)
	return entityDesc, err
}

func (db *DB) AddChunkToEntityDescription(entityID primitive.ObjectID, chunkID primitive.ObjectID) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	update := bson.M{
		"$addToSet": bson.M{"bookChunkIds": chunkID},
		"$set":      bson.M{"updatedAt": time.Now().UTC()},
	}
	_, err := db.EntityDescriptionsCollection.UpdateByID(ctx, entityID, update)
	return err
}

func (db *DB) DeleteBookData(bookID primitive.ObjectID) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Delete from new entity collections
	if _, err := db.EntitiesCollection.DeleteMany(ctx, bson.M{"bookId": bookID}); err != nil {
		return err
	}
	if _, err := db.EntityMentionsCollection.DeleteMany(ctx, bson.M{"bookId": bookID}); err != nil {
		return err
	}
	// Delete from legacy entity-descriptions collection
	if _, err := db.EntityDescriptionsCollection.DeleteMany(ctx, bson.M{"bookId": bookID}); err != nil {
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
