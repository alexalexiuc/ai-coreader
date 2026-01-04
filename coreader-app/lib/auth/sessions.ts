import { ObjectId } from 'mongodb';
import { collections, getDb } from '../db/mongo';
import { generateSessionToken } from './utils';

export interface Session {
  _id?: ObjectId;
  token: string;
  userId: ObjectId;
  createdAt: Date;
  expiresAt: Date;
}

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Create a new session for a user
 */
export async function createSession(userId: ObjectId): Promise<string> {
  const db = await getDb();
  const token = generateSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  await db.collection<Session>(collections.SESSIONS).insertOne({
    token,
    userId,
    createdAt: now,
    expiresAt,
  });

  return token;
}

/**
 * Get user ID from a session token
 */
export async function getUserFromSession(token: string): Promise<ObjectId | null> {
  const db = await getDb();
  const session = await db.collection<Session>(collections.SESSIONS).findOne({
    token,
    expiresAt: { $gt: new Date() },
  });

  return session?.userId ?? null;
}

/**
 * Delete a session (logout)
 */
export async function deleteSession(token: string): Promise<void> {
  const db = await getDb();
  await db.collection<Session>(collections.SESSIONS).deleteOne({ token });
}
