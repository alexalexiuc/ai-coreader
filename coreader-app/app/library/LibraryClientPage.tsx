'use client';

import { PageContainer } from '@/ui/PageContainer';
import { Section } from '@/ui/Section';
import { SectionHeader } from '@/ui/SectionHeader';
import { useLibrary } from '@/hooks';
import { BookCardGrid } from '@/app/library/BookCardGrid';
import { BookRow } from '@/app/library/BookRow';
import { EmptyLibrary, EmptyFiltered } from '@/app/library/LibraryEmptyStates';
import { IoSearchOutline, IoCloudUploadOutline, IoStorefrontOutline, IoGridOutline, IoListOutline } from 'react-icons/io5';

import type { FilterKey, SortKey, LibraryBook } from '@/app/library/types';
import { Select } from '@/ui/Select';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { ViewToggle } from '@/ui/ViewToggle';
import { useEffect } from 'react';
import { listBooksAction } from '@/app/library/actions';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'reading', label: 'Reading' },
  { key: 'unread', label: 'Unread' },
  { key: 'finished', label: 'Finished' },
  { key: 'pinned', label: 'Pinned' },
] as const;

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'lastOpened', label: 'Last opened' },
  { key: 'recentlyAdded', label: 'Recently added' },
  { key: 'title', label: 'Title A-Z' },
  { key: 'progress', label: 'Progress' },
];

const ViewToggleOptions = [
  { key: 'grid', label: 'Grid', Icon: IoGridOutline, ariaLabel: 'Grid view' },
  { key: 'list', label: 'List', Icon: IoListOutline, ariaLabel: 'List view' },
] as const;

type LibraryClientPageProps = {
  initialBooks: LibraryBook[];
};

export default function LibraryClientPage({ initialBooks }: LibraryClientPageProps) {
  const {
    books,
    setBooks,
    query,
    setQuery,
    filter,
    setFilter,
    sort,
    setSort,
    view,
    setView,
    counts,
    filtered,
    isEmptyAll,
    isEmptyFiltered,
    togglePin,
  } = useLibrary(initialBooks);
  const shouldPoll = books.some((book) => book.processed !== true);

  useEffect(() => {
    if (!shouldPoll) return;
    const interval = setInterval(() => {
      // TODO(coreader-app): replace polling with websockets for processing book updates.
      listBooksAction()
        .then((nextBooks) => {
          setBooks(nextBooks);
        })
        .catch((err) => {
          console.error('Failed to refresh library books', err);
        });
    }, 5000);
    return () => clearInterval(interval);
  }, [setBooks, shouldPoll]);

  return (
    <PageContainer>
      <SectionHeader label="Library" title="Your books" actions={<AvailableActions />} />

      {/* Search + controls */}
      <Section paddingClass="p-4">
        <div className="flex flex-col gap-3 rounded-2xl sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <IoSearchOutline className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or author…"
              className="w-full rounded-xl border border-slate-800 bg-slate-950/70 py-2 pr-3 pl-10 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-slate-700"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Select value={sort} onChange={setSort} options={SORTS} aria-label="Sort" className="w-40" />
            <ViewToggle<'grid' | 'list'> value={view} onChange={setView} options={ViewToggleOptions} />
          </div>
        </div>
      </Section>

      {/* Filters */}
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

      {/* Main list */}
      <Section paddingClass="p-5" header={{ title: 'Books', titleSize: 'lg' }}>
        {/* Empty states */}
        {isEmptyAll ? (
          <EmptyLibrary />
        ) : isEmptyFiltered ? (
          <EmptyFiltered query={query} onClear={() => setQuery('')} filter={filter} />
        ) : view === 'grid' ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((b) => (
              <BookCardGrid key={b.id} book={b} onTogglePin={togglePin} />
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {filtered.map((b) => (
              <BookRow key={b.id} book={b} onTogglePin={togglePin} />
            ))}
          </div>
        )}
      </Section>
    </PageContainer>
  );
}

function AvailableActions() {
  return (
    <div className="flex items-center gap-2">
      <Button href="/uploads" leftIcon={<IoCloudUploadOutline />}>
        Upload
      </Button>
      <Button href="/shop" leftIcon={<IoStorefrontOutline />} disabled>
        Shop <Badge>Soon</Badge>
      </Button>
    </div>
  );
}
