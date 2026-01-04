import { ActionsSection } from '@/app/ActionsSection';
import { ContinueReadingSection, type ContinueReadingEntry } from '@/app/ContinueReadingSection';
import { RecentUploads, type RecentUpload } from '@/app/RecentUploads';
import { TipsList } from '@/ui/TipsList';
import { WorkspaceOverview, type WorkspaceStats } from '@/app/WorkspaceOverview';
import { PageContainer } from '@/ui/PageContainer';
import { getCurrentUser } from '@/lib/auth/cookies';
import {
  getUserBooksCount,
  getMostRecentUserBook,
  getInProgressBooksCount,
} from '@/lib/db/user-books';
import { getRecentFilesWithBooks, getProcessingFilesCount } from '@/lib/db/files';
import { findBookById } from '@/lib/db/books';

export const dynamic = 'force-dynamic';

/**
 * Helper to format time since last opened
 */
function getTimeSince(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return diffDays === 1 ? 'Yesterday' : `${diffDays} days ago`;
  }
  if (diffHours > 0) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }
  if (diffMins > 0) {
    return diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
  }
  return 'Just now';
}

export default async function Home() {
  const user = await getCurrentUser();
  const isGuest = !user;

  let stats: WorkspaceStats;
  let continueReading: ContinueReadingEntry | null = null;
  let recentUploads: RecentUpload[] = [];

  if (isGuest) {
    // Guest state - empty data
    stats = {
      booksTotal: 0,
      processingCount: 0,
      lastOpened: null,
      inProgressCount: 0,
      lastRead: null,
    };
  } else {
    // Authenticated user - fetch real data
    const [
      booksTotal,
      processingCount,
      inProgressCount,
      mostRecentUserBook,
      recentFiles,
    ] = await Promise.all([
      getUserBooksCount(user.id),
      getProcessingFilesCount(user.id),
      getInProgressBooksCount(user.id),
      getMostRecentUserBook(user.id),
      getRecentFilesWithBooks(user.id, 5),
    ]);

    // Build stats
    let lastOpened = null;
    if (mostRecentUserBook) {
      const book = await findBookById(mostRecentUserBook.bookId);
      if (book) {
        const timeSince = getTimeSince(new Date(mostRecentUserBook.lastOpenedAt!));
        lastOpened = {
          title: book.title ?? 'Untitled',
          detail: timeSince,
        };
      }
    }

    stats = {
      booksTotal,
      processingCount,
      inProgressCount,
      lastOpened,
      lastRead: null,
    };

    // Build continue reading
    if (mostRecentUserBook) {
      const book = await findBookById(mostRecentUserBook.bookId);
      if (book) {
        const progressPercent = mostRecentUserBook.progressPercent ?? 0;
        const timeSince = getTimeSince(new Date(mostRecentUserBook.lastOpenedAt!));
        continueReading = {
          title: book.title ?? 'Untitled',
          progressLabel: `${Math.round(progressPercent)}%`,
          ctaPath: `/reader/${book.id}`,
          lastSession: timeSince,
        };
      }
    }

    // Build recent uploads
    recentUploads = recentFiles.map((file) => ({
      title: file.originalName,
      status: file.status as 'processing' | 'processed' | 'failed',
      percentage: file.percentage,
      bookId: file.bookId,
      bookTitle: file.bookTitle,
    }));
  }

  return (
    <PageContainer>
      <WorkspaceOverview stats={stats} isGuest={isGuest} />

      <div className="grid gap-4 lg:grid-cols-3">
        <ContinueReadingSection continueReading={continueReading} isGuest={isGuest} />
        <RecentUploads recentUploads={recentUploads} isGuest={isGuest} />
      </div>

      <ActionsSection />

      <TipsList />
    </PageContainer>
  );
}
