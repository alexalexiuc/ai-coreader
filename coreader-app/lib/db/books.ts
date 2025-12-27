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
  const db = await getDb();
  const doc = await db.collection<BooksDoc>(collections.BOOKS).findOne({ fileId: new ObjectId(fileId) });

  return doc ? toDTO(doc) : null;
}

export async function findBookById(bookId: string): Promise<BookDTO | null> {
  const db = await getDb();
  const doc = await db.collection<BooksDoc>(collections.BOOKS).findOne({ _id: new ObjectId(bookId) });

  return doc ? toDTO(doc) : null;
}

// Backward-compatible alias
export const fetchBooks = listBooks;
