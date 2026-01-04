import { Section } from '../ui/Section';
import Link from 'next/link';
import { AuthButtons } from '@/app/AuthButtons';

export type RecentUpload = {
  title: string;
  status: 'processing' | 'processed' | 'failed' | 'pending';
  percentage?: number;
  bookId?: string;
  bookTitle?: string;
};

export function RecentUploads({ recentUploads, isGuest = false }: { recentUploads: RecentUpload[]; isGuest?: boolean }) {
  return (
    <Section
      header={{
        title: 'Recent uploads',
        titleSize: 'lg',
      }}
      paddingClass="p-5"
    >
      {isGuest ? (
        <div>
          <p className="mt-3 text-sm text-slate-400">
            Uploads are available after you sign in. Create an account to upload and process your books.
          </p>
          <AuthButtons />
        </div>
      ) : recentUploads.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">Nothing yet. Upload a book to see status and quick links here.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {recentUploads.map((upload, idx) => (
            <div
              key={`${upload.title}-${idx}`}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{upload.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-slate-400 capitalize">{upload.status}</p>
                  {upload.status === 'processing' && upload.percentage !== undefined && (
                    <p className="text-xs text-slate-400">• {Math.round(upload.percentage)}%</p>
                  )}
                  {upload.status === 'processed' && upload.bookTitle && (
                    <Link href={`/reader/${upload.bookId}`} className="text-xs text-blue-400 hover:text-blue-300">
                      • Read now
                    </Link>
                  )}
                </div>
              </div>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] ml-2 ${
                  upload.status === 'processed'
                    ? 'border-emerald-800 bg-emerald-900/30 text-emerald-300'
                    : upload.status === 'processing'
                      ? 'border-amber-800 bg-amber-900/30 text-amber-300'
                      : upload.status === 'failed'
                        ? 'border-red-800 bg-red-900/30 text-red-300'
                        : 'border-slate-800 bg-slate-900 text-slate-300'
                }`}
              >
                {upload.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
