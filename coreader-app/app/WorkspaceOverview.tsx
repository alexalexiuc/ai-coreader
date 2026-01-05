import { Card } from '../ui/Card';
import { Section } from '../ui/Section';

type WorkspaceOverviewProps = {
  stats: WorkspaceStats;
  isGuest?: boolean;
};

export type WorkspaceStats = {
  booksTotal: number;
  processingCount: number;
  lastOpened: null | { title: string; detail: string };
  inProgressCount: number;
  lastRead: null | { description: string };
};

export function WorkspaceOverview({ stats, isGuest = false }: WorkspaceOverviewProps) {
  if (isGuest) {
    const highlightItems = [
      {
        label: 'Fast parsing & pagination',
        description: 'Upload PDFs or EPUBs and jump into a clean reader instantly.',
      },
      {
        label: 'Characters, places, entities',
        description: 'Keep track of who is who with automatic entity highlights.',
      },
      {
        label: 'Ask with context',
        description: 'Summaries and answers stay grounded in your uploaded books.',
      },
    ];

    return (
      <Section
        header={{
          label: 'Welcome',
          title: 'Welcome to AI Co-Reader',
          description: 'Upload a book and get summaries, entities, and a smarter reading experience.',
        }}
      >
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {highlightItems.map((item) => (
            <Card key={item.label}>
              <p className="text-lg font-semibold text-white">{item.label}</p>
              <p className="mt-2 text-sm text-slate-300">{item.description}</p>
            </Card>
          ))}
        </div>
      </Section>
    );
  }

  const dashboardItems = [
    {
      label: 'Total books',
      value: stats.booksTotal > 0 ? `${stats.booksTotal} books` : 'No books yet',
      description: 'Uploads + processed titles',
    },
    {
      label: 'Last opened',
      value: stats.lastOpened?.title ?? 'No recent books',
      description: stats.lastOpened?.detail ?? 'Start reading to see progress here',
    },
    {
      label: 'In progress',
      value: stats.inProgressCount > 0 ? `${stats.inProgressCount} books` : 'No books',
      description: stats.lastRead?.description ?? 'No recent reading',
    },
  ];

  return (
    <Section
      header={{
        label: 'Workspace',
        title: 'Your reading dashboard',
        description: 'Pick up where you left off, check processing, or add new books to your library.',
        actions: (
          <Card>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <span className={`h-2 w-2 rounded-full ${stats.processingCount > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              {stats.processingCount > 0 ? `${stats.processingCount} processing` : 'Queue idle'}
            </div>
          </Card>
        ),
      }}
    >
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {dashboardItems.map((item) => (
          <DashboardItem key={item.label} label={item.label} value={item.value} description={item.description} />
        ))}
      </div>
    </Section>
  );
}

function DashboardItem({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <Card>
      <p className="text-xs tracking-[0.2em] text-slate-500 uppercase">{label}</p>
      <p className="text-xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </Card>
  );
}
