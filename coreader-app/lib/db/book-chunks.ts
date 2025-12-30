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
  llmProcessed: boolean;
  entities?: BookChunkDoc['entities'];
  chapters?: BookChunkDoc['chapters'];
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
    llmProcessed: doc.llmProcessed,
    entities: doc.entities,
    chapters: doc.chapters,
  };
}

export async function findBookChunkByIndex(bookId: string, index: number): Promise<BookChunkDTO | null> {
  const db = await getDb();
  const doc = await db.collection<BookChunkDoc>(collections.BOOK_CHUNKS).findOne({ bookId: new ObjectId(bookId), index });

  return doc ? toDTO(doc) : null;
}

export async function countBookChunks(bookId: string): Promise<number> {
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(bookId);
  } catch {
    return 0;
  }

  const db = await getDb();
  return db.collection<BookChunkDoc>(collections.BOOK_CHUNKS).countDocuments({ bookId: objectId });
}
