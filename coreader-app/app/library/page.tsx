import type { LibraryBook } from '@/app/library/types';
import LibraryClientPage from '@/app/library/LibraryClientPage';
import { listBooks, type BookDTO } from '@/lib/db/books';

export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  const books = await listBooks();
  const libraryBooks = books.map(toLibraryBook);

  return <LibraryClientPage initialBooks={libraryBooks} />;
}

function toLibraryBook(book: BookDTO): LibraryBook {
  return {
    id: book.id,
    title: book.title ?? 'Untitled book',
    author: book.author,
    source: book.source === 'user_upload' ? 'uploaded' : 'shop',
    addedAt: book.createdAt,
    lastOpenedAt: book.updatedAt,
    progressPct: book.finished ? 100 : 0,
    isPinned: false,
  };
}
