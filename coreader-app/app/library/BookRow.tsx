import Link from 'next/link';
import { IoBookOutline } from 'react-icons/io5';
import type { LibraryBook } from '@/app/library/types';
import { clampPct } from '@/lib/number';
import { formatRelativeDate } from '@/lib/date';
import { PinButton } from './PinButton';

type BookRowProps = {
  book: LibraryBook;
  onTogglePin: (id: string) => void;
};

export const BookRow: React.FC<BookRowProps> = ({ book, onTogglePin }) => {
  const pct = clampPct(book.progressPct) ?? 0;
  const isProcessed = book.processed;
  const statusLabel = !isProcessed ? 'Processing' : pct === 0 ? 'Unread' : pct >= 100 ? 'Finished' : `${pct}%`;

  const content = (
    <>
      <p className="truncate text-sm font-semibold text-white">{book.title}</p>
      <p className="mt-0.5 truncate text-xs text-slate-400">
        {(book.author ?? '—') + ' • ' + (book.source === 'uploaded' ? 'Uploaded' : 'Shop')}
      </p>

      <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
        <span>{book.lastOpenedAt ? `Opened ${formatRelativeDate(book.lastOpenedAt)}` : `Added ${formatRelativeDate(book.addedAt)}`}</span>
        <span className="rounded-full border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-[11px] text-slate-300">{statusLabel}</span>
      </div>

      {isProcessed && pct > 0 && (
        <div className="mt-2 h-2 w-full max-w-md rounded-full border border-slate-800 bg-slate-900/60">
          <div className="h-full rounded-full bg-slate-200/70" style={{ width: `${pct}%` }} />
        </div>
      )}
    </>
  );

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3 transition hover:border-slate-700">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-2 text-slate-200">
        <IoBookOutline />
      </div>

      {isProcessed ? (
        <Link href={`/reader/${book.id}`} className="min-w-0 flex-1 outline-none focus:ring-slate-600">
          {content}
        </Link>
      ) : (
        <div className="min-w-0 flex-1 cursor-not-allowed opacity-70" aria-disabled="true">
          {content}
        </div>
      )}

      <PinButton book={book} onTogglePin={onTogglePin} />
    </div>
  );
};
