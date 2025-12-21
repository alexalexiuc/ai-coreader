import Link from 'next/link';
import { IoCloudUploadOutline, IoStorefrontOutline } from 'react-icons/io5';
import type { FilterKey } from '@/app/library/types';

export function EmptyLibrary() {
  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 p-6">
      <p className="text-sm font-semibold text-white">Your library is empty</p>
      <p className="mt-2 text-sm text-slate-400">
        Library shows books that are ready to read. Uploaded files appear in Uploads until
        processed.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link
          href="/uploads"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm text-slate-200 hover:border-slate-700"
        >
          <IoCloudUploadOutline />
          Upload a book
        </Link>
        <Link
          href="/shop"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm text-slate-200 opacity-70"
          aria-disabled="true"
          onClick={(e) => e.preventDefault()}
          title="Coming soon"
        >
          <IoStorefrontOutline />
          Browse free books
          <span className="ml-1 rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-300">
            Soon
          </span>
        </Link>
      </div>
    </div>
  );
}

export function EmptyFiltered({
  query,
  onClear,
  filter,
}: {
  query: string;
  onClear: () => void;
  filter: FilterKey;
}) {
  const hasQuery = query.trim().length > 0;

  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 p-6">
      <p className="text-sm font-semibold text-white">
        {hasQuery ? `No matches for “${query.trim()}”` : 'Nothing here yet'}
      </p>
      <p className="mt-2 text-sm text-slate-400">
        {hasQuery
          ? 'Try a different search term, or clear the search.'
          : filter === 'pinned'
            ? 'Pin books to keep them at the top.'
            : filter === 'reading'
              ? 'Start a book to see it here.'
              : filter === 'finished'
                ? 'Finish a book to see it here.'
                : 'Try another filter.'}
      </p>

      {hasQuery && (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm text-slate-200 hover:border-slate-700"
        >
          Clear search
        </button>
      )}
    </div>
  );
}
