import { Section } from '../ui/Section';

export type RecentUpload = {
  title: string;
  status: 'processing' | 'processed' | 'failed';
};

export function RecentUploads({ recentUploads }: { recentUploads: RecentUpload[] }) {
  return (
    <Section
      header={{
        title: 'Recent uploads',
        titleSize: 'lg',
      }}
      paddingClassName="p-5"
    >
      {recentUploads.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          Nothing yet. Upload a book to see status and quick links here.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {recentUploads.map((b) => (
            <div
              key={b.title}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-white">{b.title}</p>
                <p className="text-xs text-slate-400">{b.status}</p>
              </div>
              <span className="rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-300">
                {b.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
