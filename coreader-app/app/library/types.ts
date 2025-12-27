export type LibraryBook = {
  id: string;
  title: string;
  author?: string;
  source: 'uploaded' | 'shop';
  addedAt: string; // ISO
  lastOpenedAt?: string; // ISO
  progressPct?: number; // 0..100
  isPinned?: boolean;
};

export type FilterKey = 'all' | 'reading' | 'unread' | 'finished' | 'pinned';
export type SortKey = 'lastOpened' | 'recentlyAdded' | 'title' | 'progress';
export type ViewKey = 'grid' | 'list';
