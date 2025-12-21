import { ObjectId } from 'mongodb';
import { collections, getDb } from './mongo';

export type FileStatus = 'pending' | 'processing' | 'processed' | 'failed';

export interface FileDoc {
  _id: ObjectId;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  storageName: string;
  createdAt: Date;
  updatedAt: Date;
  status: FileStatus;
}

export interface FileDTO {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  storageName: string;
  createdAt: string;
  status: FileStatus;
}

function toDTO(doc: FileDoc): FileDTO {
  return {
    id: doc._id.toHexString(),
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    size: doc.size,
    storagePath: doc.storagePath,
    storageName: doc.storageName,
    createdAt: doc.createdAt.toISOString(),
    status: doc.status,
  };
}

export async function insertFileMetadata(
  params: Omit<FileDoc, '_id' | 'createdAt' | 'updatedAt'>,
): Promise<FileDTO> {
  const db = await getDb();
  const now = new Date();

  const result = await db.collection<Omit<FileDoc, '_id'>>(collections.FILES).insertOne({
    originalName: params.originalName,
    mimeType: params.mimeType,
    size: params.size,
    storageName: params.storageName,
    createdAt: now,
    updatedAt: now,
    status: params.status ?? 'pending',
    storagePath: params.storagePath,
  });

  const inserted = await db
    .collection<FileDoc>(collections.FILES)
    .findOne({ _id: result.insertedId });

  if (!inserted) {
    throw new Error('Failed to fetch inserted file metadata');
  }

  return toDTO(inserted);
}

export async function listFiles(): Promise<FileDTO[]> {
  const db = await getDb();
  const docs = await db
    .collection<FileDoc>(collections.FILES)
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  return docs.map(toDTO);
}

export async function getFileById(id: string): Promise<FileDoc | null> {
  const db = await getDb();
  return db.collection<FileDoc>(collections.FILES).findOne({ _id: new ObjectId(id) });
}

export async function deleteFileById(id: string): Promise<FileDoc | null> {
  const db = await getDb();
  const coll = db.collection<FileDoc>(collections.FILES);
  const doc = await coll.findOne({ _id: new ObjectId(id) });
  if (!doc) return null;

  await coll.deleteOne({ _id: doc._id });
  return doc;
}
