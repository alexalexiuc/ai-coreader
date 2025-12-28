import fs from 'fs/promises';
import path from 'path';
import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB_NAME ?? 'llm_reader';
const storageRoot = process.env.FILE_STORAGE_ROOT ?? path.join(process.cwd(), '..', 'storage');

let client: MongoClient | null = null;

async function getClient(): Promise<MongoClient> {
  if (client) return client;
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 4000 });
  await client.connect();
  return client;
}

export async function getDb() {
  const conn = await getClient();
  return conn.db(dbName);
}

async function ensureStorage() {
  const filesDir = path.join(storageRoot, 'files');
  await fs.mkdir(filesDir, { recursive: true });
  return filesDir;
}

export async function resetUploadsFixtures() {
  const db = await getDb();
  const filesColl = db.collection('files');
  const booksColl = db.collection('books');

  await filesColl.deleteMany({});
  await booksColl.deleteMany({});

  const filesDir = await ensureStorage();
  await fs.rm(filesDir, { recursive: true, force: true });
  await fs.mkdir(filesDir, { recursive: true });

  const now = new Date();

  const completedId = new ObjectId();
  const processingId = new ObjectId();
  const failedId = new ObjectId();

  const seedFiles = [
    {
      _id: completedId,
      originalName: 'completed_story.txt',
      mimeType: 'text/plain',
      size: 2048,
      storagePath: 'files',
      storageName: 'completed_story.txt',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 4),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 3),
      status: 'processed',
      percentage: 100,
    },
    {
      _id: processingId,
      originalName: 'draft_processing.txt',
      mimeType: 'text/plain',
      size: 1024,
      storagePath: 'files',
      storageName: 'draft_processing.txt',
      createdAt: new Date(now.getTime() - 1000 * 60 * 30),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 20),
      status: 'processing',
      percentage: 35,
    },
    {
      _id: failedId,
      originalName: 'broken_upload.txt',
      mimeType: 'text/plain',
      size: 512,
      storagePath: 'files',
      storageName: 'broken_upload.txt',
      createdAt: new Date(now.getTime() - 1000 * 60 * 90),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 80),
      status: 'failed',
      percentage: 0,
    },
  ];

  await filesColl.insertMany(seedFiles);

  await booksColl.insertOne({
    _id: new ObjectId(),
    fileId: completedId,
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 2),
    updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 2),
    title: 'Completed Story',
    totalChars: 12000,
    totalChunks: 12,
    processed: true,
    source: 'user_upload',
  });

  await Promise.all(
    seedFiles.map((file) => fs.writeFile(path.join(filesDir, file.storageName), `${file.originalName}\nseed content`)),
  );
}

export async function closeDb() {
  if (client) {
    await client.close();
    client = null;
  }
}
