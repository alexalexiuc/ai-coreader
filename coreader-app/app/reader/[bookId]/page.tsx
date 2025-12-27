import { notFound } from 'next/navigation';
import ReaderClientPage from './ReaderClientPage';
import type { Block, Book } from './types';
import { findBookById } from '@/lib/db/books';
import { findBookChunkByIndex } from '@/lib/db/book-chunks';

export const dynamic = 'force-dynamic';

type ReaderPageProps = {
  params: { bookId: string };
  searchParams?: { page?: string };
};

export default async function ReaderPage({ params, searchParams }: ReaderPageProps) {
  const bookDto = await findBookById(params.bookId);
  if (!bookDto) {
    notFound();
  }

  const totalPages = Math.max(bookDto.totalChunks, 1);
  const requestedPage = Number(searchParams?.page ?? '1');
  const pageNumber = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
  const safePageNumber = Math.min(Math.max(pageNumber, 1), totalPages);
  const pageIndex = safePageNumber - 1;

  const chunk = await findBookChunkByIndex(bookDto.id, pageIndex);
  const blocks = chunk ? chunkToBlocks(chunk.text, pageIndex) : fallbackBlocks(pageIndex);

  const book: Book = {
    id: bookDto.id,
    title: bookDto.title ?? 'Untitled book',
    author: bookDto.author,
    description: undefined,
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
    const clean = para.replace(/\n+/g, ' ').trim();
    if (!clean) continue;
    blocks.push({ id: `b-${pageIndex}-${idx}`, text: clean });
  }

  return blocks.length > 0 ? blocks : fallbackBlocks(pageIndex);
}
