import { ObjectId } from 'mongodb';
import { BooksDoc } from './generated/db-types';
import { collections, getDb } from './mongo';

export type BookDTO = {
  id: string;
  fileId: string;
  title?: string;
  author?: string;
  publisher?: string;
  year?: string;
  genre?: string;
  description?: string;
  totalChars: number;
  totalChunks: number;
  processed: boolean;
  source: BooksDoc['source'];
  createdAt: string;
  updatedAt: string;
};

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toDTO(doc: BooksDoc): BookDTO {
  return {
    id: doc._id.toHexString(),
    fileId: doc.fileId.toHexString(),
    title: doc.title,
    author: doc.author,
    publisher: doc.publisher,
    year: doc.year,
    genre: doc.genre,
    description: doc.description,
    totalChars: toNumber(doc.totalChars),
    totalChunks: toNumber(doc.totalChunks),
    processed: doc.processed,
    source: doc.source,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listBooks(): Promise<BookDTO[]> {
  const db = await getDb();
  const books = await db.collection<BooksDoc>(collections.BOOKS).find({}).sort({ createdAt: -1 }).toArray();

  return books.map(toDTO);
}

export async function findBookByFileId(fileId: string): Promise<BookDTO | null> {
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(fileId);
  } catch {
    return null;
  }

  const db = await getDb();
  const doc = await db.collection<BooksDoc>(collections.BOOKS).findOne({ fileId: objectId });

  return doc ? toDTO(doc) : null;
}

export async function findBookById(bookId: string): Promise<BookDTO | null> {
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(bookId);
  } catch {
    return null;
  }

  const db = await getDb();
  const doc = await db.collection<BooksDoc>(collections.BOOKS).findOne({ _id: objectId });

  return doc ? toDTO(doc) : null;
}

/**
 * Get books owned by a specific user (via user-books collection)
 */
export async function getUserBooks(userId: string): Promise<BookDTO[]> {
  const db = await getDb();
  const userIdObj = new ObjectId(userId);

  const books = await db
    .collection<BooksDoc>(collections.BOOKS)
    .aggregate<BooksDoc>([
      {
        $lookup: {
          from: collections.USER_BOOKS,
          let: { bookId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$bookId', '$$bookId'] }, { $eq: ['$userId', userIdObj] }],
                },
              },
            },
          ],
          as: 'userBook',
        },
      },
      {
        $match: {
          userBook: { $ne: [] },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
    ])
    .toArray();

  return books.map(toDTO);
}
