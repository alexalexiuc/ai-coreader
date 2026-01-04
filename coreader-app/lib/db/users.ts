import { ObjectId } from 'mongodb';
import { collections, getDb, withMongoValidation } from './mongo';
import { UsersDoc } from './generated/db-types';

export interface UserDTO {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
}

function toDTO(doc: UsersDoc): UserDTO {
  return {
    id: doc._id.toHexString(),
    email: doc.email,
    firstName: doc.firstName,
    lastName: doc.lastName,
    createdAt: doc.createdAt.toISOString(),
  };
}

/**
 * Create a new user
 */
export async function createUser(params: {
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
}): Promise<UserDTO> {
  const db = await getDb();
  const now = new Date();

  const userDoc: Omit<UsersDoc, '_id'> = {
    email: params.email,
    passwordHash: params.passwordHash,
    firstName: params.firstName,
    lastName: params.lastName,
    createdAt: now,
    updatedAt: now,
  };

  const result = await withMongoValidation(() => 
    db.collection<UsersDoc>(collections.USERS).insertOne(userDoc as UsersDoc)
  );

  const created = await db.collection<UsersDoc>(collections.USERS).findOne({ _id: result.insertedId });
  if (!created) {
    throw new Error('Failed to retrieve created user');
  }

  return toDTO(created);
}

/**
 * Find user by email
 */
export async function findUserByEmail(email: string): Promise<UsersDoc | null> {
  const db = await getDb();
  return db.collection<UsersDoc>(collections.USERS).findOne({ email });
}

/**
 * Find user by ID
 */
export async function findUserById(id: string | ObjectId): Promise<UsersDoc | null> {
  const db = await getDb();
  const _id = typeof id === 'string' ? new ObjectId(id) : id;
  return db.collection<UsersDoc>(collections.USERS).findOne({ _id });
}

/**
 * Get user DTO by ID (without password hash)
 */
export async function getUserById(id: string | ObjectId): Promise<UserDTO | null> {
  const user = await findUserById(id);
  return user ? toDTO(user) : null;
}
