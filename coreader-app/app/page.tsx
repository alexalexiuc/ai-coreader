import { ActionsSection } from '@/app/ActionsSection';
import { ContinueReadingSection, type ContinueReadingEntry } from '@/app/ContinueReadingSection';
import { RecentUploads, type RecentUpload } from '@/app/RecentUploads';
import { TipsList } from '@/ui/TipsList';
import { WorkspaceOverview, type WorkspaceStats } from '@/app/WorkspaceOverview';
import { PageContainer } from '@/ui/PageContainer';

export default function Home() {
  // Replace these with real data when you wire it up.
  const stats: WorkspaceStats = {
    booksTotal: 0,
    processingCount: 0,
    lastOpened: null as null | { title: string; detail: string },
    inProgressCount: 0,
    lastRead: null as null | { description: string },
  };

  const continueReading: ContinueReadingEntry | null = null;

  const recentUploads: RecentUpload[] = [];

  return (
    <PageContainer>
      <WorkspaceOverview stats={stats} />

      <div className="grid gap-4 lg:grid-cols-3">
        <ContinueReadingSection continueReading={continueReading} />
        <RecentUploads recentUploads={recentUploads} />
      </div>

      <ActionsSection />

      <TipsList />
    </PageContainer>
  );
}
