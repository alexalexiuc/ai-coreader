import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME ?? 'llm_reader';

let clientPromise: Promise<MongoClient> | null = null;

function ensureUri() {
  if (!uri) throw new Error('MONGODB_URI is not set (create .env.local)');
}

export async function getClient(): Promise<MongoClient> {
  ensureUri();
  if (!clientPromise) {
    clientPromise = new MongoClient(uri!, { serverSelectionTimeoutMS: 4000 }).connect().catch((err) => {
      console.error('Mongo connection failed:', err.message);
      clientPromise = null; // allow retries
      throw new Error(`Failed to connect to MongoDB at ${uri}: ${err.message}`);
    });
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(dbName);
}

export const collections = {
  FILES: 'files',
  BOOKS: 'books',
};
