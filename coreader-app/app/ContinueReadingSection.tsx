import { IoCloudUploadOutline, IoLibraryOutline, IoPlayOutline, IoTimeOutline } from 'react-icons/io5';
import { Card } from '../ui/Card';
import { ActionCard } from '../ui/ActionCard';
import { Section } from '../ui/Section';
import Link from 'next/link';
import { AuthButtons } from '@/app/AuthButtons';

export type ContinueReadingEntry = {
  title: string;
  progressLabel: string; // e.g. "Chapter 4  38%"
  ctaPath: string;
  lastSession: string; // e.g. "Yesterday 24 min"
};

export type ContinueReadingSectionProps = {
  continueReading: ContinueReadingEntry | null;
  isGuest?: boolean;
};

// TODO: Cards should be actions

export function ContinueReadingSection({ continueReading, isGuest = false }: ContinueReadingSectionProps) {
  return (
    <Section
      header={{
        title: 'Continue reading',
        titleSize: 'lg',
      }}
      className="lg:col-span-2"
      paddingClass="p-4"
    >
      <Card className="mt-4">
        {isGuest ? (
          <div>
            <p className="text-sm font-semibold text-white">Sign in to sync reading progress</p>
            <p className="mt-1 text-xs text-slate-400">
              Create an account to track your progress across devices and pick up where you left off.
            </p>
            <AuthButtons />
          </div>
        ) : !continueReading ? (
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
            <Link
              href={continueReading.ctaPath}
              className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              <IoPlayOutline className="-mt-0.5 mr-2 inline" />
              Resume
            </Link>
          </div>
        )}
      </Card>
    </Section>
  );
}
