import clsx from 'clsx';
import { IoChevronBackOutline, IoChevronForwardOutline } from 'react-icons/io5';
import type { Block } from './types';
import { Button } from '@/ui/Button';

type ReaderTextViewProps = {
  blocks: Block[];
  pageNumber: number;
  totalPages: number;
  bookId: string;
  contentWidth: number;
  fontSize: number;
  lineHeight: number;
};

export function ReaderTextView({ blocks, pageNumber, totalPages, bookId, contentWidth, fontSize, lineHeight }: ReaderTextViewProps) {
  const hasPages = totalPages > 0;
  const canPrev = hasPages && pageNumber > 1;
  const canNext = hasPages && pageNumber < totalPages;
  const prevPage = Math.max(1, pageNumber - 1);
  const nextPage = Math.min(totalPages, pageNumber + 1);
  const makePageHref = (page: number) => `/reader/${bookId}?page=${page}`;

  return (
    <>
      <div
        className="mx-auto h-[calc(100vh-140px)]"
        style={{
          maxWidth: contentWidth,
          fontSize,
          lineHeight,
        }}
      >
        <div className="h-full space-y-4 overflow-y-auto pr-2">
          {blocks.map((b) => (
            <p
              key={b.id}
              id={b.id}
              data-block-id={b.id}
              className={clsx(
                'rounded-xl px-3 py-2 text-slate-100/95',
                b.text.toUpperCase() === b.text && b.text.length < 60 && 'font-semibold text-slate-200',
                'selection:bg-slate-200/20',
              )}
            >
              {b.text}
            </p>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-6 flex max-w-6xl flex-wrap items-center justify-center gap-3 pb-8">
        <Button href={makePageHref(prevPage)} disabled={!canPrev} leftIcon={<IoChevronBackOutline />}>
          Prev
        </Button>
        <div className="rounded-full border border-slate-800 bg-slate-950/70 px-4 py-1 text-xs text-slate-400">
          {hasPages ? `Page ${pageNumber} / ${totalPages}` : 'Page -'}
          {canNext && ` · Next ${nextPage}`}
        </div>
        <Button href={makePageHref(nextPage)} disabled={!canNext} rightIcon={<IoChevronForwardOutline />}>
          Next
        </Button>
      </div>
    </>
  );
}
