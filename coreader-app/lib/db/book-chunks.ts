import { ObjectId } from 'mongodb';
import { collections, getDb } from './mongo';
import type { BookChunksDoc } from './generated/db-types';

export type ChunkEntityRefDTO = {
  entityId: string;
  name: string;
  type: string;
  startOffsets: number[];
};

export type BookChunkDTO = {
  id: string;
  bookId: string;
  index: number;
  text: string;
  startChar: number;
  endChar: number;
  llmProcessed: boolean;
  entities?: ChunkEntityRefDTO[];
  chapters?: BookChunksDoc['chapters'];
};

function toDTO(doc: BookChunksDoc): BookChunkDTO {
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
    entities: doc.entities?.map((e) => ({
      entityId: e.entityId.toHexString(),
      name: e.name,
      type: e.type,
      startOffsets: e.startOffsets,
    })),
    chapters: doc.chapters,
  };
}

export async function findBookChunkByIndex(bookId: string, index: number): Promise<BookChunkDTO | null> {
  const db = await getDb();
  const doc = await db.collection<BookChunksDoc>(collections.BOOK_CHUNKS).findOne({ bookId: new ObjectId(bookId), index });

  return doc ? toDTO(doc) : null;
}

export async function findBookChunkIndexesByIds(chunkIds: string[]): Promise<Map<string, number>> {
  const objectIds: ObjectId[] = [];
  for (const chunkId of chunkIds) {
    try {
      objectIds.push(new ObjectId(chunkId));
    } catch {
      // ignore invalid ids
    }
  }

  if (objectIds.length === 0) {
    return new Map();
  }

  const db = await getDb();
  const docs = await db
    .collection<BookChunksDoc>(collections.BOOK_CHUNKS)
    .find({ _id: { $in: objectIds } }, { projection: { index: 1 } })
    .toArray();

  const map = new Map<string, number>();
  for (const doc of docs) {
    if (!doc._id) continue;
    map.set(doc._id.toHexString(), doc.index);
  }
  return map;
}

export async function countBookChunks(bookId: string): Promise<number> {
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(bookId);
  } catch {
    return 0;
  }

  const db = await getDb();
  return db.collection<BookChunksDoc>(collections.BOOK_CHUNKS).countDocuments({ bookId: objectId });
}
