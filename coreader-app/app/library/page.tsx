import LibraryClientPage from '@/app/library/LibraryClientPage';
import { listBooks } from '@/lib/db/books';
import { toLibraryBook } from '@/app/library/utils';

export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  const books = await listBooks();
  const libraryBooks = books.map(toLibraryBook);

  return <LibraryClientPage initialBooks={libraryBooks} />;
}
