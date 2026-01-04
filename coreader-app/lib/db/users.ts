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
export async function createUser(params: { email: string; passwordHash: string; firstName?: string; lastName?: string }): Promise<UserDTO> {
  const db = await getDb();
  const now = new Date();

  const userDoc: Partial<Omit<UsersDoc, '_id'>> = {
    email: params.email,
    passwordHash: params.passwordHash,
    createdAt: now,
    updatedAt: now,
  };

  // Only include optional fields if they have values
  if (params.firstName) {
    userDoc.firstName = params.firstName;
  }
  if (params.lastName) {
    userDoc.lastName = params.lastName;
  }

  const result = await withMongoValidation(() => db.collection<UsersDoc>(collections.USERS).insertOne(userDoc as UsersDoc));

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

/**
 * Update user password
 */
export async function updateUserPassword(id: string | ObjectId, passwordHash: string): Promise<void> {
  const db = await getDb();
  const _id = typeof id === 'string' ? new ObjectId(id) : id;

  await withMongoValidation(() =>
    db.collection<UsersDoc>(collections.USERS).updateOne({ _id }, { $set: { passwordHash, updatedAt: new Date() } }),
  );
}

/**
 * Update user profile (name)
 */
export async function updateUserProfile(id: string | ObjectId, updates: { firstName?: string; lastName?: string }): Promise<UserDTO> {
  const db = await getDb();
  const _id = typeof id === 'string' ? new ObjectId(id) : id;

  const updateFields: Partial<Pick<UsersDoc, 'firstName' | 'lastName' | 'updatedAt'>> = { 
    updatedAt: new Date() 
  };
  
  // Only include fields that are explicitly provided
  if (updates.firstName !== undefined) {
    updateFields.firstName = updates.firstName;
  }
  if (updates.lastName !== undefined) {
    updateFields.lastName = updates.lastName;
  }

  await withMongoValidation(() =>
    db.collection<UsersDoc>(collections.USERS).updateOne({ _id }, { $set: updateFields }),
  );

  const updated = await db.collection<UsersDoc>(collections.USERS).findOne({ _id });
  if (!updated) {
    throw new Error('Failed to retrieve updated user');
  }

  return toDTO(updated);
}
