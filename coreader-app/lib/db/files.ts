import { ObjectId } from 'mongodb';
import { collections, getDb, withMongoValidation } from './mongo';
import { BooksDoc, FilesDoc } from './generated/db-types';
import { clampPct } from '../number';

export type FileStatus = FilesDoc['status'];

export interface FileDTO {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  storageName: string;
  createdAt: string;
  status: FileStatus;
  percentage?: number;
  userId?: string;
}

export interface FileWithBookDTO extends FileDTO {
  bookId?: string;
  bookTitle?: string;
}

type FileWithBookDoc = FilesDoc & { book?: BooksDoc };

function toDTO(doc: FilesDoc): FileDTO {
  if (!doc._id) {
    throw new Error('File document is missing _id');
  }

  const size = Number(doc.size);
  const normalizedSize = Number.isFinite(size) ? size : 0;
  const percentage = clampPct(doc.percentage ?? 0);

  return {
    id: doc._id.toHexString(),
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    size: normalizedSize,
    storagePath: doc.storagePath,
    storageName: doc.storageName,
    createdAt: doc.createdAt.toISOString(),
    status: doc.status,
    percentage,
    userId: doc.userId?.toHexString(),
  };
}

export async function insertFileMetadata(params: Omit<FilesDoc, '_id' | 'createdAt' | 'updatedAt'>): Promise<FileDTO> {
  const db = await getDb();
  const now = new Date();

  console.log({
    originalName: params.originalName,
    mimeType: params.mimeType,
    size: params.size,
    storageName: params.storageName,
    createdAt: now,
    updatedAt: now,
    status: params.status ?? 'pending',
    storagePath: params.storagePath,
    percentage: clampPct(params.percentage ?? 0),
    userId: params.userId,
  });

  const result = await withMongoValidation(() =>
    db.collection<Omit<FilesDoc, '_id'>>(collections.FILES).insertOne({
      originalName: params.originalName,
      mimeType: params.mimeType,
      size: params.size,
      storageName: params.storageName,
      createdAt: now,
      updatedAt: now,
      status: params.status ?? 'pending',
      storagePath: params.storagePath,
      percentage: clampPct(params.percentage ?? 0),
      userId: params.userId,
    }),
  );

  const inserted = await db.collection<FilesDoc>(collections.FILES).findOne({ _id: result.insertedId });

  if (!inserted) {
    throw new Error('Failed to fetch inserted file metadata');
  }

  return toDTO(inserted);
}

export async function listFiles(): Promise<FileDTO[]> {
  const db = await getDb();
  const docs = await db.collection<FilesDoc>(collections.FILES).find({}).sort({ createdAt: -1 }).toArray();

  return docs.map(toDTO);
}

export async function listFilesWithBooks(userId?: ObjectId): Promise<FileWithBookDTO[]> {
  const db = await getDb();
  const filter = userId ? { userId } : {};
  const docs = await db
    .collection<FilesDoc>(collections.FILES)
    .aggregate<FileWithBookDoc>([
      { $match: filter },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: collections.BOOKS,
          let: { fileId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$fileId', '$$fileId'],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: 'book',
        },
      },
      {
        $unwind: {
          path: '$book',
          preserveNullAndEmptyArrays: true,
        },
      },
    ])
    .toArray();

  return docs.map((doc) => ({
    ...toDTO(doc),
    bookId: doc.book?._id.toHexString(),
    bookTitle: doc.book?.title,
  }));
}

export async function getFileById(id: string): Promise<FilesDoc | null> {
  const db = await getDb();
  return db.collection<FilesDoc>(collections.FILES).findOne({ _id: new ObjectId(id) });
}

export async function deleteFileById(id: string): Promise<FilesDoc | null> {
  const db = await getDb();
  const coll = db.collection<FilesDoc>(collections.FILES);
  const doc = await coll.findOne({ _id: new ObjectId(id) });
  if (!doc) return null;

  await coll.deleteOne({ _id: doc._id });
  return doc;
}

export async function resetFileForReprocessing(id: string): Promise<void> {
  const db = await getDb();
  const now = new Date();

  await withMongoValidation(() =>
    db.collection<FilesDoc>(collections.FILES).updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'pending',
          percentage: 0,
          errorMessage: '',
          updatedAt: now,
        },
      },
    ),
  );
}

/**
 * Get recent files with books for a user (limited)
 */
export async function getRecentFilesWithBooks(userId: string, limit: number = 5): Promise<FileWithBookDTO[]> {
  const db = await getDb();
  const userIdObj = new ObjectId(userId);
  const docs = await db
    .collection<FilesDoc>(collections.FILES)
    .aggregate<FileWithBookDoc>([
      { $match: { userId: userIdObj } },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: collections.BOOKS,
          let: { fileId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$fileId', '$$fileId'],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: 'book',
        },
      },
      {
        $unwind: {
          path: '$book',
          preserveNullAndEmptyArrays: true,
        },
      },
    ])
    .toArray();

  return docs.map((doc) => ({
    ...toDTO(doc),
    bookId: doc.book?._id.toHexString(),
    bookTitle: doc.book?.title,
  }));
}

/**
 * Get count of files currently being processed for a user
 */
export async function getProcessingFilesCount(userId: string): Promise<number> {
  const db = await getDb();
  const userIdObj = new ObjectId(userId);

  return db.collection<FilesDoc>(collections.FILES).countDocuments({
    userId: userIdObj,
    status: 'processing',
  });
}
