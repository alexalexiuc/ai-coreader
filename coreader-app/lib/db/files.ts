import { ObjectId } from 'mongodb';
import { collections, getDb } from './mongo';
import { BooksDoc, FilesDoc } from './generated/db-types';

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
  const percentage =
    doc.percentage === undefined ? undefined : Number.isFinite(Number(doc.percentage)) ? Number(doc.percentage) : undefined;

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
  };
}

export async function insertFileMetadata(
  params: Omit<FilesDoc, '_id' | 'createdAt' | 'updatedAt'>,
): Promise<FileDTO> {
  const db = await getDb();
  const now = new Date();

  const result = await db.collection<Omit<FilesDoc, '_id'>>(collections.FILES).insertOne({
    originalName: params.originalName,
    mimeType: params.mimeType,
    size: params.size,
    storageName: params.storageName,
    createdAt: now,
    updatedAt: now,
    status: params.status ?? 'pending',
    storagePath: params.storagePath,
    percentage: params.percentage,
  });

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

export async function listFilesWithBooks(): Promise<FileWithBookDTO[]> {
  const db = await getDb();
  const docs = await db
    .collection<FilesDoc>(collections.FILES)
    .aggregate<FileWithBookDoc>([
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: collections.BOOKS,
          localField: '_id',
          foreignField: 'fileId',
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
