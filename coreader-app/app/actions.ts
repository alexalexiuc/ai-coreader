'use server';

import { getCurrentUser } from '@/lib/auth/cookies';
import { getUserBooksCount, getMostRecentUserBook, getInProgressBooksCount } from '@/lib/db/user-books';
import { getRecentFilesWithBooks, getProcessingFilesCount } from '@/lib/db/files';
import { findBookById } from '@/lib/db/books';
import { getTimeSince } from '@/lib/utils/time';
import type { ContinueReadingEntry } from '@/app/ContinueReadingSection';
import type { RecentUpload } from '@/app/RecentUploads';
import type { WorkspaceStats } from '@/app/WorkspaceOverview';

export interface DashboardData {
  isGuest: boolean;
  stats: WorkspaceStats;
  continueReading: ContinueReadingEntry | null;
  recentUploads: RecentUpload[];
}

export async function getDashboardDataAction(): Promise<DashboardData> {
  const user = await getCurrentUser();
  const isGuest = !user;

  let stats: WorkspaceStats;
  let continueReading: ContinueReadingEntry | null = null;
  let recentUploads: RecentUpload[] = [];

  if (isGuest) {
    stats = {
      booksTotal: 0,
      processingCount: 0,
      lastOpened: null,
      inProgressCount: 0,
      lastRead: null,
    };

    return { isGuest, stats, continueReading, recentUploads };
  }

  const [booksTotal, processingCount, inProgressCount, mostRecentUserBook, recentFiles] = await Promise.all([
    getUserBooksCount(user.id),
    getProcessingFilesCount(user.id),
    getInProgressBooksCount(user.id),
    getMostRecentUserBook(user.id),
    getRecentFilesWithBooks(user.id, 5),
  ]);

  let lastOpened = null;
  if (mostRecentUserBook && mostRecentUserBook.lastOpenedAt) {
    const book = await findBookById(mostRecentUserBook.bookId);
    if (book) {
      const timeSince = getTimeSince(new Date(mostRecentUserBook.lastOpenedAt));
      const progressPercent = mostRecentUserBook.progressPercent ?? 0;

      lastOpened = {
        title: book.title ?? 'Untitled',
        detail: timeSince,
      };

      continueReading = {
        title: book.title ?? 'Untitled',
        progressLabel: `${Math.round(progressPercent)}%`,
        ctaPath: `/reader/${book.id}`,
        lastSession: timeSince,
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

  recentUploads = recentFiles.map((file) => ({
    title: file.originalName,
    status: file.status,
    percentage: file.percentage,
    bookId: file.bookId,
    bookTitle: file.bookTitle,
  }));

  return { isGuest, stats, continueReading, recentUploads };
}
