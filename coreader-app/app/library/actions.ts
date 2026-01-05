'use server';

import { type BookDTO } from '@/lib/db/books';
import { getCurrentUser } from '@/lib/auth/cookies';
import { getUserBook, getUserBooks, setBookPinState } from '@/lib/db/user-books';
import { getDb, collections } from '@/lib/db/mongo';
import { ObjectId } from 'mongodb';
import { BooksDoc } from '@/lib/db/generated/db-types';
import { toLibraryBook } from '@/app/library/utils';
import type { LibraryBook } from '@/app/library/types';

function mapBookDocToDTO(doc: BooksDoc): BookDTO {
  return {
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
  };
}

async function getLibraryBooksForUser(userId: string): Promise<LibraryBook[]> {
  const userBooks = await getUserBooks(userId);
  const userBookIds = userBooks.map((ub) => ub.bookId);

  if (userBookIds.length === 0) {
    return [];
  }

  const userBookById = new Map(userBooks.map((ub) => [ub.bookId, ub]));

  // Fetch only the books that the user owns
  const db = await getDb();
  const books = await db
    .collection<BooksDoc>(collections.BOOKS)
    .find({
      _id: { $in: userBookIds.map((id) => new ObjectId(id)) },
    })
    .sort({ createdAt: -1 })
    .toArray();

  return books.map((doc) => {
    const book = mapBookDocToDTO(doc);
    const userBook = userBookById.get(book.id);

    return toLibraryBook(book, {
      isPinned: userBook?.isPinned ?? false,
      progressPercent: userBook?.progressPercent,
      lastOpenedAt: userBook?.lastOpenedAt,
    });
  });
}

export async function listBooksAction(): Promise<LibraryBook[]> {
  const user = await getCurrentUser();
  if (!user) {
    return []; // Return empty list for unauthenticated users
  }

  return getLibraryBooksForUser(user.id);
}

export async function togglePinAction(bookId: string): Promise<{ isPinned: boolean }> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const userBook = await getUserBook(user.id, bookId);

  if (!userBook) {
    throw new Error('Book not found');
  }

  const nextPinned = !userBook.isPinned;
  await setBookPinState(user.id, bookId, nextPinned);

  return { isPinned: nextPinned };
}

export { getLibraryBooksForUser };
