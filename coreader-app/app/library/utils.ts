import type { LibraryBook } from '@/app/library/types';
import type { BookDTO } from '@/lib/db/books';

export function toLibraryBook(book: BookDTO): LibraryBook {
  return {
    id: book.id,
    title: book.title ?? 'Untitled book',
    author: book.author,
    description: book.description,
    source: book.source === 'user_upload' ? 'uploaded' : 'shop',
    addedAt: book.createdAt,
    lastOpenedAt: book.updatedAt,
    // TODO: progress should be calculated from last work user read
    progressPct: book.processed ? 100 : 0,
    processed: book.processed,
    isPinned: false,
  };
}
