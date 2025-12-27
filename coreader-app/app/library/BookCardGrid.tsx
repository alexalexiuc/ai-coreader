import Link from 'next/link';
import { IoBookOutline } from 'react-icons/io5';
import type { LibraryBook } from '@/app/library/types';
import { clampPct } from '@/lib/number';
import { formatRelativeDate } from '@/lib/date';
import { PinButton } from './PinButton';

type BookCardGridProps = {
  book: LibraryBook;
  onTogglePin: (id: string) => void;
};

export function BookCardGrid({ book, onTogglePin }: BookCardGridProps) {
  const pct = clampPct(book.progressPct) ?? 0;
  const isFinished = pct >= 100;
  const isReading = pct > 0 && pct < 100;
  const isProcessed = book.processed;
  const actionLabel = isProcessed ? (pct === 0 ? 'Start reading' : 'Resume') : 'Processing...';

  return (
    <div className="relative rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700">
      {isProcessed ? (
        <Link href={`/reader/${book.id}`} className="block outline-none focus:ring-slate-600">
          <div className="flex justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl border border-slate-800 bg-slate-900/50 p-2 text-slate-200">
                <IoBookOutline />
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold text-white">{book.title}</p>
                <p className="mt-1 truncate text-xs text-slate-400">{book.author ?? '-'}</p>
              </div>
            </div>
            <div className="mt-0.5">
              <PinButton book={book} onTogglePin={onTogglePin} />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="rounded-full border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-[11px] text-slate-300">
              {book.source === 'uploaded' ? 'Uploaded' : 'Shop'}
            </span>
            <span className="text-xs text-slate-400">
              {book.lastOpenedAt ? `Opened ${formatRelativeDate(book.lastOpenedAt)}` : `Added ${formatRelativeDate(book.addedAt)}`}
            </span>
          </div>

          {(isReading || isFinished) && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{isFinished ? 'Finished' : 'Progress'}</span>
                <span>{pct}%</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full border border-slate-800 bg-slate-900/60">
                <div className="h-full rounded-full bg-slate-200/70" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">{actionLabel}</div>
        </Link>
      ) : (
        <div className="block cursor-not-allowed opacity-70" aria-disabled="true">
          <div className="flex justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl border border-slate-800 bg-slate-900/50 p-2 text-slate-200">
                <IoBookOutline />
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold text-white">{book.title}</p>
                <p className="mt-1 truncate text-xs text-slate-400">{book.author ?? '-'}</p>
              </div>
            </div>
            <div className="mt-0.5">
              <PinButton book={book} onTogglePin={onTogglePin} />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="rounded-full border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-[11px] text-slate-300">
              {book.source === 'uploaded' ? 'Uploaded' : 'Shop'}
            </span>
            <span className="text-xs text-slate-400">Processing</span>
          </div>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">{actionLabel}</div>
        </div>
      )}
    </div>
  );
}
