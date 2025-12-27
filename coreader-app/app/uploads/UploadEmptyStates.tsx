import type { FilterKey } from '@/app/uploads/types';
import { IoCloudUploadOutline } from 'react-icons/io5';

export function EmptyUploads() {
  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 p-6">
      <p className="text-sm font-semibold text-white">No files uploaded yet</p>
      <p className="mt-2 text-sm text-slate-400">
        Upload a file to start processing it into a book. Completed uploads will link to the created book.
      </p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm text-slate-200">
        <IoCloudUploadOutline />
        Use the upload button to begin
      </div>
    </div>
  );
}

export function EmptyFiltered({ query, filter, onClear }: { query: string; filter: FilterKey; onClear: () => void }) {
  const hasQuery = query.trim().length > 0;

  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 p-6">
      <p className="text-sm font-semibold text-white">{hasQuery ? `No matches for "${query.trim()}"` : 'Nothing here'}</p>
      <p className="mt-2 text-sm text-slate-400">
        {hasQuery
          ? 'Try a different search term, or clear the search.'
          : filter === 'failed'
            ? 'No failed uploads.'
            : filter === 'processing'
              ? 'No files are currently processing.'
              : filter === 'completed'
                ? 'No completed uploads yet.'
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
