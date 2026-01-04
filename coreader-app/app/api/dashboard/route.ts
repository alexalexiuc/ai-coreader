import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/cookies';
import {
  getUserBooksCount,
  getMostRecentUserBook,
  getInProgressBooksCount,
} from '@/lib/db/user-books';
import { getRecentFilesWithBooks, getProcessingFilesCount } from '@/lib/db/files';
import { findBookById } from '@/lib/db/books';

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();

    // Return empty/guest state if not authenticated
    if (!user) {
      return NextResponse.json({
        isGuest: true,
        stats: {
          booksTotal: 0,
          processingCount: 0,
          inProgressCount: 0,
          lastOpened: null,
        },
        continueReading: null,
        recentUploads: [],
      });
    }

    // Fetch all data in parallel for authenticated users
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

    // Get book details for most recent book (for both continueReading and lastOpened)
    let continueReading = null;
    let lastOpened = null;
    if (mostRecentUserBook) {
      const book = await findBookById(mostRecentUserBook.bookId);
      if (book) {
        const progressPercent = mostRecentUserBook.progressPercent ?? 0;
        const timeSince = getTimeSince(new Date(mostRecentUserBook.lastOpenedAt!));
        
        continueReading = {
          bookId: book.id,
          title: book.title ?? 'Untitled',
          author: book.author,
          progressPercent,
          progressLabel: `${Math.round(progressPercent)}%`,
          lastOpenedAt: mostRecentUserBook.lastOpenedAt,
          lastPageIndex: mostRecentUserBook.lastPageIndex,
          lastChunkIndex: mostRecentUserBook.lastChunkIndex,
        };
        
        lastOpened = {
          title: book.title ?? 'Untitled',
          detail: timeSince,
        };
      }
    }

    // Format recent uploads
    const recentUploads = recentFiles.map((file) => ({
      id: file.id,
      originalName: file.originalName,
      status: file.status,
      percentage: file.percentage,
      bookId: file.bookId,
      bookTitle: file.bookTitle,
      createdAt: file.createdAt,
    }));

    return NextResponse.json({
      isGuest: false,
      stats: {
        booksTotal,
        processingCount,
        inProgressCount,
        lastOpened,
      },
      continueReading,
      recentUploads,
    });
  } catch (error: any) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

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
