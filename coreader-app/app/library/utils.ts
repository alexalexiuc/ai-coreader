import type { LibraryBook } from '@/app/library/types';
import type { BookDTO } from '@/lib/db/books';

type UserBookState = {
  isPinned?: boolean;
  progressPercent?: number;
  lastOpenedAt?: string;
};

export function toLibraryBook(book: BookDTO, userState?: UserBookState): LibraryBook {
  return {
    id: book.id,
    title: book.title ?? 'Untitled book',
    author: book.author,
    description: book.description,
    source: book.source === 'user_upload' ? 'uploaded' : 'shop',
    addedAt: book.createdAt,
    lastOpenedAt: userState?.lastOpenedAt ?? book.updatedAt,
    progressPct: userState?.progressPercent ?? (book.processed ? 100 : 0),
    processed: book.processed,
    isPinned: userState?.isPinned ?? false,
  };
}
