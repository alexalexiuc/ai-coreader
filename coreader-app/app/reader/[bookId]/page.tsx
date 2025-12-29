import { notFound } from 'next/navigation';
import ReaderClientPage from './ReaderClientPage';
import type { Block, Book } from './types';
import { findBookById } from '@/lib/db/books';
import { countBookChunks, findBookChunkByIndex } from '@/lib/db/book-chunks';

export const dynamic = 'force-dynamic';

type ReaderPageProps = {
  params: { bookId: string } | Promise<{ bookId: string }>;
  searchParams?: { page?: string } | Promise<{ page?: string }>;
};

export default async function ReaderPage({ params, searchParams }: ReaderPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  console.log('ReaderPage params:', resolvedParams, 'searchParams:', resolvedSearchParams);
  const bookDto = await findBookById(resolvedParams.bookId);
  if (!bookDto) {
    notFound();
  }

  const chunkCount = await countBookChunks(bookDto.id);
  const totalPagesSource = chunkCount > 0 ? chunkCount : bookDto.totalChunks;
  const totalPages = Math.max(totalPagesSource, 1);
  const requestedPage = Number(resolvedSearchParams?.page ?? '1');
  const pageNumber = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
  const safePageNumber = Math.min(Math.max(pageNumber, 1), totalPages);
  const pageIndex = safePageNumber - 1;

  const chunk = await findBookChunkByIndex(bookDto.id, pageIndex);
  const blocks = chunk ? chunkToBlocks(chunk.text, pageIndex) : fallbackBlocks(pageIndex);

  const book: Book = {
    id: bookDto.id,
    title: bookDto.title ?? 'Untitled book',
    author: bookDto.author,
    description: bookDto.description,
    chapters: [],
  };

  return <ReaderClientPage book={book} blocks={blocks} pageNumber={safePageNumber} totalPages={totalPages} />;
}

function fallbackBlocks(pageIndex: number): Block[] {
  return [{ id: `b-${pageIndex}-0`, text: 'No content available for this page.' }];
}

function chunkToBlocks(text: string, pageIndex: number): Block[] {
  const normalized = text.replace(/\r\n/g, '\n');
  const paragraphs = normalized.split(/\n{2,}/);
  const blocks: Block[] = [];

  for (const [idx, para] of paragraphs.entries()) {
    // only replace new lines when between two lowercase letters (to avoid breaking lists, headings, etc)
    const clean = para.replace(/\n+/g, ' ').trim();
    if (!clean) continue;
    blocks.push({ id: `b-${pageIndex}-${idx}`, text: clean });
  }

  console.log(`chunkToBlocks for pageIndex ${pageIndex}:`, blocks);

  return blocks.length > 0 ? blocks : fallbackBlocks(pageIndex);
}
