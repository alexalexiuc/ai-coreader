import { ObjectId } from 'mongodb';
import { collections, getDb, withMongoValidation } from './mongo';
import { UserBooksDoc } from './generated/db-types';

export interface UserBookDTO {
  id: string;
  userId: string;
  bookId: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  lastPageIndex?: number;
  lastChunkIndex?: number;
  lastCharOffset?: number;
  progressPercent?: number;
  startedAt?: string;
  finishedAt?: string;
}

function toDTO(doc: UserBooksDoc): UserBookDTO {
  if (!doc._id) {
    throw new Error('UserBooks document is missing _id');
  }

  return {
    id: doc._id.toHexString(),
    userId: doc.userId.toHexString(),
    bookId: doc.bookId.toHexString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    lastOpenedAt: doc.lastOpenedAt?.toISOString(),
    lastPageIndex: doc.lastPageIndex,
    lastChunkIndex: doc.lastChunkIndex,
    lastCharOffset: doc.lastCharOffset,
    progressPercent: doc.progressPercent,
    startedAt: doc.startedAt?.toISOString(),
    finishedAt: doc.finishedAt?.toISOString(),
  };
}

/**
 * Create or update a user-book link (ownership)
 * Called when a book is created from a user-uploaded file
 */
export async function createOrUpdateUserBook(userId: string, bookId: string): Promise<UserBookDTO> {
  const db = await getDb();
  const now = new Date();

  const userIdObj = new ObjectId(userId);
  const bookIdObj = new ObjectId(bookId);

  // Check if link already exists
  const existing = await db.collection<UserBooksDoc>(collections.USER_BOOKS).findOne({
    userId: userIdObj,
    bookId: bookIdObj,
  });

  if (existing) {
    // Update timestamp
    await withMongoValidation(() =>
      db.collection<UserBooksDoc>(collections.USER_BOOKS).updateOne(
        { _id: existing._id },
        {
          $set: {
            updatedAt: now,
          },
        },
      ),
    );
    return toDTO({ ...existing, updatedAt: now });
  }

  // Create new link
  const result = await withMongoValidation(() =>
    db.collection<Omit<UserBooksDoc, '_id'>>(collections.USER_BOOKS).insertOne({
      userId: userIdObj,
      bookId: bookIdObj,
      createdAt: now,
      updatedAt: now,
    }),
  );

  const inserted = await db.collection<UserBooksDoc>(collections.USER_BOOKS).findOne({ _id: result.insertedId });

  if (!inserted) {
    throw new Error('Failed to fetch inserted user-book link');
  }

  return toDTO(inserted);
}

/**
 * Update reading progress for a user's book
 */
export async function updateReadingProgress(
  userId: string,
  bookId: string,
  progress: {
    lastPageIndex?: number;
    lastChunkIndex?: number;
    lastCharOffset?: number;
    progressPercent?: number;
  },
): Promise<void> {
  const db = await getDb();
  const now = new Date();

  const userIdObj = new ObjectId(userId);
  const bookIdObj = new ObjectId(bookId);

  const baseFields = {
    lastOpenedAt: now,
    updatedAt: now,
  };

  // Only include defined progress fields
  const updateFields = Object.fromEntries(
    Object.entries({ ...baseFields, ...progress }).filter(([_, value]) => value !== undefined),
  ) as Partial<UserBooksDoc>;

  await withMongoValidation(() =>
    db.collection<UserBooksDoc>(collections.USER_BOOKS).updateOne(
      {
        userId: userIdObj,
        bookId: bookIdObj,
      },
      {
        $set: updateFields,
        $setOnInsert: {
          createdAt: now,
          userId: userIdObj,
          bookId: bookIdObj,
        },
      },
      { upsert: true },
    ),
  );
}

/**
 * Get user's books (My Library)
 */
export async function getUserBooks(userId: string): Promise<UserBookDTO[]> {
  const db = await getDb();
  const userIdObj = new ObjectId(userId);

  const docs = await db.collection<UserBooksDoc>(collections.USER_BOOKS).find({ userId: userIdObj }).sort({ updatedAt: -1 }).toArray();

  return docs.map(toDTO);
}

/**
 * Get a specific user-book link
 */
export async function getUserBook(userId: string, bookId: string): Promise<UserBookDTO | null> {
  const db = await getDb();
  const userIdObj = new ObjectId(userId);
  const bookIdObj = new ObjectId(bookId);

  const doc = await db.collection<UserBooksDoc>(collections.USER_BOOKS).findOne({
    userId: userIdObj,
    bookId: bookIdObj,
  });

  return doc ? toDTO(doc) : null;
}

/**
 * Check if a user owns a book
 */
export async function userOwnsBook(userId: string, bookId: string): Promise<boolean> {
  const db = await getDb();
  const userIdObj = new ObjectId(userId);
  const bookIdObj = new ObjectId(bookId);

  const count = await db.collection<UserBooksDoc>(collections.USER_BOOKS).countDocuments({
    userId: userIdObj,
    bookId: bookIdObj,
  });

  return count > 0;
}

/**
 * Check if a user owns a file (via userId field)
 */
export async function userOwnsFile(userId: string, fileId: string): Promise<boolean> {
  const db = await getDb();
  const userIdObj = new ObjectId(userId);
  const fileIdObj = new ObjectId(fileId);

  const count = await db.collection(collections.FILES).countDocuments({
    _id: fileIdObj,
    userId: userIdObj,
  });

  return count > 0;
}

/**
 * Get the most recently opened book for a user (for "Continue Reading")
 */
export async function getMostRecentUserBook(userId: string): Promise<UserBookDTO | null> {
  const db = await getDb();
  const userIdObj = new ObjectId(userId);

  const doc = await db
    .collection<UserBooksDoc>(collections.USER_BOOKS)
    .find({ userId: userIdObj, lastOpenedAt: { $exists: true } })
    .sort({ lastOpenedAt: -1 })
    .limit(1)
    .toArray();

  return doc.length > 0 ? toDTO(doc[0]) : null;
}

/**
 * Get count of user's books that are in progress (not finished)
 */
export async function getInProgressBooksCount(userId: string): Promise<number> {
  const db = await getDb();
  const userIdObj = new ObjectId(userId);

  return db.collection<UserBooksDoc>(collections.USER_BOOKS).countDocuments({
    userId: userIdObj,
    finishedAt: { $exists: false },
    lastOpenedAt: { $exists: true },
  });
}

/**
 * Get total count of user's books
 */
export async function getUserBooksCount(userId: string): Promise<number> {
  const db = await getDb();
  const userIdObj = new ObjectId(userId);

  return db.collection<UserBooksDoc>(collections.USER_BOOKS).countDocuments({
    userId: userIdObj,
  });
}
