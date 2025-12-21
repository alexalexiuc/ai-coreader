import Link from 'next/link';
import {
  IoAlertCircleOutline,
  IoBookOutline,
  IoCheckmarkCircleOutline,
  IoDocumentTextOutline,
  IoDownloadOutline,
  IoRefreshOutline,
  IoTimeOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import type { UploadedFile } from '@/lib/uploads';
import { statusLabel } from '@/lib/uploads';
import { clampPct } from '@/lib/number';
import { formatBytes } from '@/lib/bytes';
import { formatRelativeDate } from '@/lib/date';
import { Badge } from '@/ui/Badge';
import { PulseDot } from '@/ui/icons/PulseDot';

type FileRowProps = {
  file: UploadedFile;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  onDownload: (id: string) => void;
};

export function FileRow({ file, onRetry, onDelete, onDownload }: FileRowProps) {
  const pct = clampPct(file.progressPct);
  const isProcessing = file.status === 'processing';
  const isCompleted = file.status === 'completed';
  const isFailed = file.status === 'failed';

  return (
    <div className="px-4 py-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center">
        <div className="sm:col-span-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl border border-slate-800 bg-slate-900/50 p-2 text-slate-200">
              <IoDocumentTextOutline />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{file.originalName}</p>

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

              {isFailed && file.errorMessage && (
                <p className="mt-1 line-clamp-1 text-xs text-rose-300/90" title={file.errorMessage}>
                  {file.errorMessage}
                </p>
              )}

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

        <div className="sm:col-span-2">
          <StatusPill status={file.status} />
        </div>

        <div className="sm:col-span-2">
          <p className="text-sm text-slate-300">{formatBytes(file.sizeBytes)}</p>
        </div>

        <div className="sm:col-span-2">
          <p className="flex items-center gap-2 text-sm text-slate-300">
            <IoTimeOutline className="text-slate-500" />
            {formatRelativeDate(file.uploadedAt)}
          </p>
        </div>

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

function StatusPill({ status }: { status: UploadedFile['status'] }) {
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
