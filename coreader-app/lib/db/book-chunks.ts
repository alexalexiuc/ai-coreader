import { ObjectId } from 'mongodb';
import { collections, getDb } from './mongo';
import type { BookChunkDoc } from './generated/db-types';

export type BookChunkDTO = {
  id: string;
  bookId: string;
  index: number;
  text: string;
  startChar: number;
  endChar: number;
  llmMetadata?: BookChunkDoc['llmMetadata'];
};

function toDTO(doc: BookChunkDoc): BookChunkDTO {
  if (!doc._id) {
    throw new Error('Book chunk document is missing _id');
  }

  return {
    id: doc._id.toHexString(),
    bookId: doc.bookId.toHexString(),
    index: doc.index,
    text: doc.text,
    startChar: doc.startChar,
    endChar: doc.endChar,
    llmMetadata: doc.llmMetadata,
  };
}

export async function findBookChunkByIndex(bookId: string, index: number): Promise<BookChunkDTO | null> {
  const db = await getDb();
  const doc = await db.collection<BookChunkDoc>(collections.BOOK_CHUNKS).findOne({ bookId: new ObjectId(bookId), index });

  return doc ? toDTO(doc) : null;
}
