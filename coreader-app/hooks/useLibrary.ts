import { useCallback, useMemo, useState } from 'react';
import type { LibraryBook, FilterKey, SortKey, ViewKey } from '@/app/library/types';
import { clampPct } from '@/lib/number';

export default function useLibrary(initialBooks: LibraryBook[] = []) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('lastOpened');
  const [view, setView] = useState<ViewKey>('grid');
  const [books, setBooks] = useState<LibraryBook[]>(initialBooks);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: books.length,
      reading: 0,
      unread: 0,
      finished: 0,
      pinned: 0,
    };
    for (const b of books) {
      const p = clampPct(b.progressPct) ?? 0;
      if (b.isPinned) c.pinned += 1;
      if (p > 0 && p < 100) c.reading += 1;
      if (p === 0) c.unread += 1;
      if (p >= 100) c.finished += 1;
    }
    return c;
  }, [books]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const byText = (b: LibraryBook) => {
      if (!q) return true;
      const hay = `${b.title} ${b.author ?? ''}`.toLowerCase();
      return hay.includes(q);
    };

    const byFilter = (b: LibraryBook) => {
      const p = clampPct(b.progressPct) ?? 0;
      switch (filter) {
        case 'all':
          return true;
        case 'reading':
          return p > 0 && p < 100;
        case 'unread':
          return p === 0;
        case 'finished':
          return p >= 100;
        case 'pinned':
          return !!b.isPinned;
        default:
          return true;
      }
    };

    const list = books.filter((b) => byText(b) && byFilter(b));

    const sorted = [...list].sort((a, b) => {
      // Always bubble pinned first (except in pinned filter where it’s all pinned anyway).
      const ap = a.isPinned ? 1 : 0;
      const bp = b.isPinned ? 1 : 0;
      if (ap !== bp) return bp - ap;

      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'progress') return (clampPct(b.progressPct) ?? 0) - (clampPct(a.progressPct) ?? 0);

      const at = sort === 'recentlyAdded' ? new Date(a.addedAt).getTime() : a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0;
      const bt = sort === 'recentlyAdded' ? new Date(b.addedAt).getTime() : b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0;

      return bt - at;
    });

    return sorted;
  }, [books, filter, query, sort]);

  const isEmptyAll = books.length === 0;
  const isEmptyFiltered = !isEmptyAll && filtered.length === 0;

  const togglePin = useCallback(async (id: string) => {
    // Get the current pin state before optimistic update
    const book = books.find((b) => b.id === id);
    const newIsPinned = !book?.isPinned;

    // Optimistically update UI
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, isPinned: newIsPinned } : b)));

    try {
      const response = await fetch(`/api/books/${id}/pin`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isPinned: newIsPinned }),
      });

      if (!response.ok) {
        // Revert on error
        setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, isPinned: !newIsPinned } : b)));
        console.error('Failed to update pin status');
      }
    } catch (error) {
      // Revert on error
      setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, isPinned: !newIsPinned } : b)));
      console.error('Error updating pin status:', error);
    }
  }, [books]);

  return {
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
  } as const;
}
