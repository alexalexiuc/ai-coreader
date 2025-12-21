'use client';

import { formatBytes } from '@/lib/bytes';
import { formatRelativeDate } from '@/lib/date';
import { clampPct } from '@/lib/number';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { FileUpload } from '@/ui/FileUpload';
import { PulseDot } from '@/ui/icons/PulseDot';
import { PageContainer } from '@/ui/PageContainer';
import { Section } from '@/ui/Section';
import { SectionHeader } from '@/ui/SectionHeader';
import { Select } from '@/ui/Select';
import { ViewToggle } from '@/ui/ViewToggle';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import {
  IoCloudUploadOutline,
  IoDocumentTextOutline,
  IoSearchOutline,
  IoAlertCircleOutline,
  IoCheckmarkCircleOutline,
  IoTimeOutline,
  IoDownloadOutline,
  IoRefreshOutline,
  IoTrashOutline,
  IoBookOutline,
  IoStorefrontOutline,
  IoLibraryOutline,
  IoWarningOutline,
} from 'react-icons/io5';
import { uploadFileAction } from './actions';

type FileStatus = 'processing' | 'completed' | 'failed';

type UploadedFile = {
  id: string;
  originalName: string;
  sizeBytes: number;
  uploadedAt: string; // ISO

  status: FileStatus;
  progressPct?: number; // 0..100 (optional)

  errorMessage?: string;

  // relationship to created book (when completed)
  bookId?: string;
  bookTitle?: string;
};

type FilterKey = 'all' | 'processing' | 'completed' | 'failed';
type SortKey = 'recent' | 'oldest' | 'name' | 'status';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'processing', label: 'Processing' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Failed' },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'name', label: 'File name A–Z' },
  { key: 'status', label: 'Status' },
];

// Replace with real data fetch.
const MOCK_FILES: UploadedFile[] = [
  {
    id: 'f1',
    originalName: 'foundation.txt',
    sizeBytes: 2_340_120,
    uploadedAt: '2025-12-18T19:05:00.000Z',
    status: 'completed',
    bookId: 'b1',
    bookTitle: 'Foundation',
  },
  {
    id: 'f2',
    originalName: 'i_robot.txt',
    sizeBytes: 1_124_221,
    uploadedAt: '2025-12-19T08:40:00.000Z',
    status: 'processing',
    progressPct: 63,
  },
  {
    id: 'f3',
    originalName: 'some_scan.pdf',
    sizeBytes: 18_204_332,
    uploadedAt: '2025-12-19T10:10:00.000Z',
    status: 'failed',
    errorMessage: 'Unsupported format (PDF) for now.',
  },
  {
    id: 'f4',
    originalName: 'bradbury_martian_chronicles.txt',
    sizeBytes: 4_800_004,
    uploadedAt: '2025-12-10T12:01:00.000Z',
    status: 'completed',
    bookId: 'b4',
    bookTitle: 'The Martian Chronicles',
  },
];

function statusLabel(s: FileStatus) {
  switch (s) {
    case 'processing':
      return 'Processing';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return s;
  }
}

function statusOrder(s: FileStatus) {
  // Processing first, then failed, then completed (so it’s actionable).
  if (s === 'processing') return 0;
  if (s === 'failed') return 1;
  return 2;
}

export default function FilesPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('recent');

  const [files, setFiles] = useState<UploadedFile[]>(MOCK_FILES);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: files.length,
      processing: 0,
      completed: 0,
      failed: 0,
    };
    for (const f of files) {
      if (f.status === 'processing') c.processing += 1;
      if (f.status === 'completed') c.completed += 1;
      if (f.status === 'failed') c.failed += 1;
    }
    return c;
  }, [files]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const byText = (f: UploadedFile) => {
      if (!q) return true;
      return f.originalName.toLowerCase().includes(q);
    };

    const byFilter = (f: UploadedFile) => {
      if (filter === 'all') return true;
      return f.status === filter;
    };

    const list = files.filter((f) => byText(f) && byFilter(f));

    const sorted = [...list].sort((a, b) => {
      if (sort === 'name') return a.originalName.localeCompare(b.originalName);

      if (sort === 'status') {
        const ao = statusOrder(a.status);
        const bo = statusOrder(b.status);
        if (ao !== bo) return ao - bo;
        // tie-breaker newest first
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      }

      const at = new Date(a.uploadedAt).getTime();
      const bt = new Date(b.uploadedAt).getTime();
      return sort === 'oldest' ? at - bt : bt - at;
    });

    return sorted;
  }, [files, filter, query, sort]);

  const isEmptyAll = files.length === 0;
  const isEmptyFiltered = !isEmptyAll && filtered.length === 0;

  // Stub handlers (replace with API calls)
  const onRetry = (id: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              status: 'processing',
              progressPct: 0,
              errorMessage: undefined,
            }
          : f,
      ),
    );
  };

  const onDelete = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const onDownload = (_id: string) => {
    // Replace with actual download action (signed URL, etc)
    // eslint-disable-next-line no-alert
    alert('Download action goes here.');
  };

  return (
    <PageContainer>
      <SectionHeader
        label="Uploads"
        title="Files"
        description=" Uploaded files appear here while they are processed into readable books."
        actions={<AvailableActions />}
      />

      <DropzoneStub />

      <Section paddingClassName="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <IoSearchOutline className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files…"
              className="w-full rounded-xl border border-slate-800 bg-slate-950/70 py-2 pr-3 pl-10 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-slate-700"
            />
          </div>

          <div className="flex items-center gap-2 sm:justify-end">
            <Select
              value={sort}
              onChange={setSort}
              options={SORTS}
              aria-label="Sort"
              className="w-36"
            />
          </div>
        </div>
      </Section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ViewToggle
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((f) => ({
            key: f.key,
            label: (
              <span>
                {f.label}
                <span className="ml-2 rounded-full border border-slate-800 bg-slate-950 px-2 py-0.5 text-[11px] text-slate-400">
                  {counts[f.key]}
                </span>
              </span>
            ),
          }))}
        />
      </div>

      <Section
        paddingClassName="p-5"
        header={{
          title: 'Uploaded files',
          titleSize: 'lg',
          actions: <span className="text-xs text-slate-500">{filtered.length} shown</span>,
        }}
      >
        {isEmptyAll ? (
          <EmptyUploads />
        ) : isEmptyFiltered ? (
          <EmptyFiltered query={query} filter={filter} onClear={() => setQuery('')} />
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
            <div className="hidden grid-cols-12 gap-3 border-b border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-400 sm:grid">
              <div className="col-span-5">File</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Size</div>
              <div className="col-span-2">Uploaded</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            <div className="divide-y divide-slate-800">
              {filtered.map((f) => (
                <FileRow
                  key={f.id}
                  file={f}
                  onRetry={onRetry}
                  onDelete={onDelete}
                  onDownload={onDownload}
                />
              ))}
            </div>
          </div>
        )}
      </Section>
    </PageContainer>
  );
}

function AvailableActions() {
  return (
    <div className="flex items-center gap-2">
      <Button href="/library" leftIcon={<IoLibraryOutline />}>
        Library
      </Button>
      <Button href="/shop" leftIcon={<IoStorefrontOutline />} disabled>
        Shop <Badge>Soon</Badge>
      </Button>
    </div>
  );
}

function DropzoneStub() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<'success' | 'error' | null>(null);
  const [isPending, startTransition] = useTransition();

  const newFile = (f: File | null) => {
    setFile(f);
    setMessage(null);
    setStatus(null);
  };

  const reset = () => {
    setMessage(null);
    setStatus(null);
    setFile(null);
  };

  const handleUpload = () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setMessage(null);
    setStatus(null);

    startTransition(async () => {
      try {
        await uploadFileAction(formData);
        setMessage('Uploaded! We will process the book and add it to your library shortly.');
        setStatus('success');
        setFile(null);
      } catch (err: any) {
        const text = err?.message || 'Upload failed. Please try again.';
        setMessage(text);
        setStatus('error');
      }
    });
  };

  return (
    <Section paddingClassName="p-5" header={{ title: 'Upload', titleSize: 'lg' }}>
      <div className="mt-2">
        <FileUpload
          accept={['text/plain', '.txt']}
          value={file}
          onFileSelect={newFile}
          label="Drop your book file"
        />
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button
          onClick={handleUpload}
          disabled={!file || isPending}
          loading={isPending}
          leftIcon={<IoCloudUploadOutline className="h-5 w-5" />}
        >
          Upload book
        </Button>
        <Button onClick={() => reset()} disabled={!file || isPending} className="text-gray-300">
          Clear selection
        </Button>
        {file && !isPending && (
          <span className="text-xs text-gray-500">Ready to upload: {file.name}</span>
        )}
      </div>

      {message && (
        <div
          className={`mt-6 flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${
            status === 'success'
              ? 'border border-green-800 bg-green-950 text-green-200'
              : 'border border-red-800 bg-red-950 text-red-200'
          }`}
        >
          {status === 'success' ? (
            <IoCheckmarkCircleOutline className="h-5 w-5" />
          ) : (
            <IoWarningOutline className="h-5 w-5" />
          )}
          <span>{message}</span>
        </div>
      )}
    </Section>
  );
}

function FileRow({
  file,
  onRetry,
  onDelete,
  onDownload,
}: {
  file: UploadedFile;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  onDownload: (id: string) => void;
}) {
  const pct = clampPct(file.progressPct);
  const isProcessing = file.status === 'processing';
  const isCompleted = file.status === 'completed';
  const isFailed = file.status === 'failed';

  return (
    <div className="px-4 py-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center">
        {/* File */}
        <div className="sm:col-span-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl border border-slate-800 bg-slate-900/50 p-2 text-slate-200">
              <IoDocumentTextOutline />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{file.originalName}</p>

              {/* Relationship to book */}
              {isCompleted && file.bookId && (
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <IoBookOutline className="text-slate-500" />
                  <span className="truncate">
                    Book created:{' '}
                    <Link
                      href={`/reader/${file.bookId}`}
                      className="text-slate-200 hover:underline"
                      title={file.bookTitle ?? file.bookId}
                    >
                      {file.bookTitle ?? 'Open book'}
                    </Link>
                  </span>
                </div>
              )}

              {/* Error */}
              {isFailed && file.errorMessage && (
                <p className="mt-1 line-clamp-1 text-xs text-rose-300/90" title={file.errorMessage}>
                  {file.errorMessage}
                </p>
              )}

              {/* Progress */}
              {isProcessing && typeof pct === 'number' && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Processing</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full border border-slate-800 bg-slate-900/60">
                    <div
                      className="h-full rounded-full bg-slate-200/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="sm:col-span-2">
          <StatusPill status={file.status} />
        </div>

        {/* Size */}
        <div className="sm:col-span-2">
          <p className="text-sm text-slate-300">{formatBytes(file.sizeBytes)}</p>
        </div>

        {/* Uploaded */}
        <div className="sm:col-span-2">
          <p className="flex items-center gap-2 text-sm text-slate-300">
            <IoTimeOutline className="text-slate-500" />
            {formatRelativeDate(file.uploadedAt)}
          </p>
        </div>

        {/* Actions */}
        <div className="sm:col-span-1 sm:justify-self-end">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onDownload(file.id)}
              className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-slate-200 hover:border-slate-700"
              aria-label="Download original file"
              title="Download"
            >
              <IoDownloadOutline />
            </button>

            {isFailed && (
              <button
                type="button"
                onClick={() => onRetry(file.id)}
                className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-slate-200 hover:border-slate-700"
                aria-label="Retry processing"
                title="Retry"
              >
                <IoRefreshOutline />
              </button>
            )}

            <button
              type="button"
              onClick={() => onDelete(file.id)}
              className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-slate-200 hover:border-slate-700"
              aria-label="Delete file"
              title="Delete"
            >
              <IoTrashOutline />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: FileStatus }) {
  let Icon;
  let colorClass;

  if (status === 'processing') {
    Icon = <PulseDot />;
    colorClass = 'border-slate-700 bg-slate-950 text-slate-200';
  } else if (status === 'completed') {
    Icon = <IoCheckmarkCircleOutline className="text-emerald-200" />;
    colorClass = 'border-emerald-900/60 bg-emerald-950/30 text-emerald-200';
  } else {
    Icon = <IoAlertCircleOutline className="text-rose-200" />;
    colorClass = 'border-rose-900/60 bg-rose-950/30 text-rose-200';
  }

  return (
    <Badge colorClass={colorClass} sizeClass="px-3 py-1" className="inline-flex items-center gap-2">
      <>
        {Icon}&nbsp;
        {statusLabel(status)}
      </>
    </Badge>
  );
}

function EmptyUploads() {
  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 p-6">
      <p className="text-sm font-semibold text-white">No files uploaded yet</p>
      <p className="mt-2 text-sm text-slate-400">
        Upload a file to start processing it into a book. Completed uploads will link to the created
        book.
      </p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm text-slate-200">
        <IoCloudUploadOutline />
        Use “Upload files” to begin
      </div>
    </div>
  );
}

function EmptyFiltered({
  query,
  filter,
  onClear,
}: {
  query: string;
  filter: FilterKey;
  onClear: () => void;
}) {
  const hasQuery = query.trim().length > 0;
  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 p-6">
      <p className="text-sm font-semibold text-white">
        {hasQuery ? `No matches for “${query.trim()}”` : 'Nothing here'}
      </p>
      <p className="mt-2 text-sm text-slate-400">
        {hasQuery
          ? 'Try a different search term, or clear the search.'
          : filter === 'failed'
            ? 'No failed uploads 🎉'
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
