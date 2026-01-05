import { ActionsSection } from '@/app/ActionsSection';
import { ContinueReadingSection } from '@/app/ContinueReadingSection';
import { RecentUploads } from '@/app/RecentUploads';
import { TipsList } from '@/ui/TipsList';
import { WorkspaceOverview } from '@/app/WorkspaceOverview';
import { PageContainer } from '@/ui/PageContainer';
import { getDashboardDataAction } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { isGuest, stats, continueReading, recentUploads } = await getDashboardDataAction();

  return (
    <PageContainer>
      <WorkspaceOverview stats={stats} isGuest={isGuest} />

      {!isGuest && (
        <div className="grid gap-4 lg:grid-cols-3">
          <ContinueReadingSection continueReading={continueReading} isGuest={isGuest} />
          <RecentUploads recentUploads={recentUploads} isGuest={isGuest} />
        </div>
      )}

      <ActionsSection />

      <TipsList />
    </PageContainer>
  );
}
