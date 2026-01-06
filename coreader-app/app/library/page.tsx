import LibraryClientPage from '@/app/library/LibraryClientPage';
import { getLibraryBooksForUser } from '@/app/library/actions';
import { getCurrentUser } from '@/lib/auth/cookies';

export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  const user = await getCurrentUser();

  // If user is authenticated, get their books; otherwise return empty list
  const libraryBooks = user ? await getLibraryBooksForUser(user.id) : [];

  return <LibraryClientPage initialBooks={libraryBooks} />;
}
