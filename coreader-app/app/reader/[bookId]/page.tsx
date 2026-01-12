import { notFound, redirect } from 'next/navigation';
import ReaderClientPage from './ReaderClientPage';
import type { Book } from './types';
import { chunkToBlocks, fallbackBlocks } from './chunkUtils';
import { findBookById } from '@/lib/db/books';
import { countBookChunks, findBookChunkByIndex } from '@/lib/db/book-chunks';
import { findEntitiesByIds } from '@/lib/db/entities';
import { getCurrentUser } from '@/lib/auth/cookies';
import { userOwnsBook, updateReadingProgress } from '@/lib/db/user-books';

export const dynamic = 'force-dynamic';

type ReaderPageProps = {
  params: { bookId: string } | Promise<{ bookId: string }>;
  searchParams?: { page?: string } | Promise<{ page?: string }>;
};

export default async function ReaderPage({ params, searchParams }: ReaderPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  console.log('ReaderPage params:', resolvedParams, 'searchParams:', resolvedSearchParams);

  // Check authentication
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const bookDto = await findBookById(resolvedParams.bookId);
  if (!bookDto) {
    notFound();
  }

  // Check ownership
  const hasAccess = await userOwnsBook(user.id, bookDto.id);
  if (!hasAccess) {
    throw new Error('Unauthorized: You do not have access to this book');
  }

  const chunkCount = await countBookChunks(bookDto.id);
  const totalPagesSource = chunkCount > 0 ? chunkCount : bookDto.totalChunks;
  const totalPages = Math.max(totalPagesSource, 1);
  const requestedPage = Number(resolvedSearchParams?.page ?? '1');
  const pageNumber = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
  const safePageNumber = Math.min(Math.max(pageNumber, 1), totalPages);
  const pageIndex = safePageNumber - 1;

  const chunk = await findBookChunkByIndex(bookDto.id, pageIndex);
  const entityIds = (chunk?.entities ?? []).map((e) => e.entityId);
  const entities = entityIds.length > 0 ? await findEntitiesByIds(entityIds) : [];
  const entityMap = new Map(entities.map((e) => [e.id, e]));

  const blocks = chunk ? chunkToBlocks(chunk.text, pageIndex, chunk.entities ?? [], entityMap) : fallbackBlocks(pageIndex);

  // Update reading progress
  const progressPercent = totalPages > 0 ? Math.round((safePageNumber / totalPages) * 100) : 0;
  await updateReadingProgress(user.id, bookDto.id, {
    lastPageIndex: pageIndex,
    lastChunkIndex: pageIndex,
    progressPercent,
  });

  const book: Book = {
    id: bookDto.id,
    title: bookDto.title ?? 'Untitled book',
    author: bookDto.author,
    description: bookDto.description,
    chapters: [],
  };

  return <ReaderClientPage book={book} blocks={blocks} pageNumber={safePageNumber} totalPages={totalPages} />;
}
