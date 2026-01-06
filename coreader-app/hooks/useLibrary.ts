import { useCallback, useMemo, useRef, useState, useTransition } from 'react';
import type { LibraryBook, FilterKey, SortKey, ViewKey } from '@/app/library/types';
import { clampPct } from '@/lib/number';
import { togglePinAction } from '@/app/library/actions';

export default function useLibrary(initialBooks: LibraryBook[] = []) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('lastOpened');
  const [view, setView] = useState<ViewKey>('grid');
  const [books, setBooks] = useState<LibraryBook[]>(initialBooks);
  const [, startTransition] = useTransition();
  const serverConfirmedPinState = useRef<Map<string, boolean>>(new Map());

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

  const togglePin = useCallback(
    (id: string) => {
      // Capture the current server-confirmed state before optimistic update
      setBooks((prev) => {
        const currentBook = prev.find((b) => b.id === id);
        if (currentBook) {
          serverConfirmedPinState.current.set(id, currentBook.isPinned ?? false);
        }
        return prev.map((b) => (b.id === id ? { ...b, isPinned: !b.isPinned } : b));
      });

      startTransition(async () => {
        try {
          const { isPinned } = await togglePinAction(id);
          // Update with server response and track confirmed state
          serverConfirmedPinState.current.set(id, isPinned);
          setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, isPinned } : b)));
        } catch (err) {
          // Rollback to the last server-confirmed state
          const previousPinned = serverConfirmedPinState.current.get(id) ?? false;
          setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, isPinned: previousPinned } : b)));
          console.error('Failed to toggle pin state', err);
        }
      });
    },
    [startTransition],
  );

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
