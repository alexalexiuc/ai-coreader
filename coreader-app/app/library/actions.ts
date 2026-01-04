'use server';

import { listBooks, type BookDTO } from '@/lib/db/books';
import { getCurrentUser } from '@/lib/auth/cookies';
import { getUserBooks } from '@/lib/db/user-books';
import { getDb, collections } from '@/lib/db/mongo';
import { ObjectId } from 'mongodb';
import { BooksDoc } from '@/lib/db/generated/db-types';

export async function listBooksAction(): Promise<BookDTO[]> {
  const user = await getCurrentUser();
  if (!user) {
    return []; // Return empty list for unauthenticated users
  }

  // Get user's book IDs from user-books collection
  const userBooks = await getUserBooks(user.id);
  const userBookIds = userBooks.map((ub) => ub.bookId);

  if (userBookIds.length === 0) {
    return [];
  }

  // Fetch only the books that the user owns
  const db = await getDb();
  const books = await db
    .collection<BooksDoc>(collections.BOOKS)
    .find({
      _id: { $in: userBookIds.map((id) => new ObjectId(id)) },
    })
    .sort({ createdAt: -1 })
    .toArray();

  return books.map((doc) => ({
    id: doc._id.toHexString(),
    fileId: doc.fileId.toHexString(),
    title: doc.title,
    author: doc.author,
    publisher: doc.publisher,
    year: doc.year,
    genre: doc.genre,
    description: doc.description,
    totalChars: Number(doc.totalChars) || 0,
    totalChunks: Number(doc.totalChunks) || 0,
    processed: doc.processed,
    source: doc.source,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }));
}
