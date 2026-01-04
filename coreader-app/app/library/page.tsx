import LibraryClientPage from '@/app/library/LibraryClientPage';
import { getUserBooks, listBooks } from '@/lib/db/books';
import { toLibraryBook } from '@/app/library/utils';
import { getCurrentUser } from '@/lib/auth/cookies';

export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  const user = await getCurrentUser();

  // If user is authenticated, get their books; otherwise return empty list
  const books = user ? await getUserBooks(user.id) : [];
  const libraryBooks = books.map(toLibraryBook);

  return <LibraryClientPage initialBooks={libraryBooks} />;
}
