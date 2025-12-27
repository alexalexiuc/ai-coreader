import { IoCloudUploadOutline, IoLibraryOutline, IoPlayOutline, IoTimeOutline } from 'react-icons/io5';
import { Card } from '../ui/Card';
import { ActionCard } from '../ui/ActionCard';
import { Section } from '../ui/Section';

export type ContinueReadingEntry = {
  title: string;
  progressLabel: string; // e.g. "Chapter 4 ƒ?› 38%"
  ctaPath: string;
  lastSession: string; // e.g. "Yesterday ƒ?› 24 min"
};

export type ContinueReadingSectionProps = {
  continueReading: ContinueReadingEntry | null;
};

// TODO: Cards should be actions

export function ContinueReadingSection({ continueReading }: ContinueReadingSectionProps) {
  // continueReading = {
  //   title: 'Sample Book Title',
  //   progressLabel: 'Chapter 4 › 38%',
  //   ctaPath: '/reader/sample-book-id',
  //   lastSession: 'Yesterday › 24 min',
  // };
  return (
    <Section
      header={{
        title: 'Continue reading',
        titleSize: 'lg',
      }}
      className="lg:col-span-2"
      paddingClass="p-4"
    >
      {/* <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Continue reading</h3>
        <span className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1 text-xs text-slate-400">
          {continueReading ? 'Resume' : 'Get started'} //TODO: This about this
        </span>
      </div> */}

      <Card className="mt-4">
        {!continueReading ? (
          <div>
            <p className="text-sm font-semibold text-white">No active book</p>
            <p className="mt-1 text-xs text-slate-400">Upload a book or pick one from your library to start reading.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <ActionCard
                icon={IoCloudUploadOutline}
                label="Upload a book"
                description="Go Uploads to proceed"
                pathTo="/uploads"
                variant="compact"
              />
              <ActionCard
                icon={IoLibraryOutline}
                label="Open your library"
                description="Browse processed titles"
                pathTo="/library"
                variant="compact"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">{continueReading.title}</p>
              <p className="mt-1 text-xs text-slate-400">{continueReading.progressLabel}</p>
              <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <IoTimeOutline /> {continueReading.lastSession}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
              <IoPlayOutline className="-mt-0.5 mr-2 inline" />
              Resume
            </div>
          </div>
        )}
      </Card>
    </Section>
  );
}
