'use client';

import { clamp } from '@/lib/number';
import clsx from 'clsx';
import React, { useEffect, useMemo, useState } from 'react';
import {
  IoBookmarkOutline,
  IoChevronBackOutline,
  IoChevronForwardOutline,
  IoInformationCircleOutline,
  IoListOutline,
  IoOptionsOutline,
  IoSearchOutline,
  IoSparklesOutline,
} from 'react-icons/io5';
import { BottomSheet, PanelBody, SidePanel, panelTitle } from './ReaderPanels';
import { SelectionToolbar } from './SelectionToolbar';
import { getNearestBlockIdToViewportTop, getSelectionBlockId, getSelectionText, safeId, scrollToBlock } from './readerUtils';
import type { Block, Book, Chapter, Highlight, PanelKey, SearchHit } from './types';
import { Button } from '@/ui/Button';
import { SquareButton } from '@/ui/SquareButton';

const TOOL_BUTTONS = [
  { key: 'overview', icon: IoInformationCircleOutline, title: 'Overview' },
  { key: 'toc', icon: IoListOutline, title: 'Table of Contents' },
  { key: 'search', icon: IoSearchOutline, title: 'Search' },
  { key: 'coach', icon: IoSparklesOutline, title: 'Coach' },
  { key: 'highlights', icon: IoBookmarkOutline, title: 'Highlights' },
  { key: 'settings', icon: IoOptionsOutline, title: 'Reader Settings' },
] as const;

type ReaderClientPageProps = {
  book: Book;
  blocks: Block[];
  pageNumber: number;
  totalPages: number;
};

export default function ReaderClientPage({ book, blocks, pageNumber, totalPages }: ReaderClientPageProps) {
  const [openPanel, setOpenPanel] = useState<PanelKey>(null);

  const [fontSize, setFontSize] = useState(18); // px
  const [lineHeight, setLineHeight] = useState(1.7);
  const [contentWidth, setContentWidth] = useState(720); // px

  const firstOpenKey = `cr:firstOpenDone:${book.id}`;
  const lastPageKey = `cr:lastPage:${book.id}`;

  const [highlights, setHighlights] = useState<Highlight[]>([]);

  const progressPct = useMemo(() => {
    if (totalPages <= 0) return 0;
    return Math.round((pageNumber / totalPages) * 100);
  }, [pageNumber, totalPages]);

  const [searchQuery, setSearchQuery] = useState('');
  const searchHits: SearchHit[] = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const hits: SearchHit[] = [];
    for (const b of blocks) {
      const idx = b.text.toLowerCase().indexOf(q);
      if (idx === -1) continue;
      const start = clamp(idx - 40, 0, b.text.length);
      const end = clamp(idx + q.length + 60, 0, b.text.length);
      const snippet = b.text.slice(start, end);
      hits.push({ id: `${b.id}:${idx}`, blockId: b.id, snippet });
      if (hits.length >= 50) break;
    }
    return hits;
  }, [blocks, searchQuery]);

  const [selOpen, setSelOpen] = useState(false);
  const [selText, setSelText] = useState('');
  const [selBlockId, setSelBlockId] = useState<string | null>(null);
  const [selPos, setSelPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const firstOpenDone = typeof window !== 'undefined' && window.localStorage.getItem(firstOpenKey) === '1';
    if (!firstOpenDone) {
      setOpenPanel('overview');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(lastPageKey, String(pageNumber));
  }, [lastPageKey, pageNumber]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selOpen) {
          setSelOpen(false);
          return;
        }
        if (openPanel) {
          setOpenPanel(null);
          return;
        }
      }

      const isMetaK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
      if (isMetaK) {
        e.preventDefault();
        setOpenPanel((p) => (p === 'search' ? null : 'search'));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openPanel, selOpen]);

  useEffect(() => {
    const handleSelection = () => {
      const text = getSelectionText().trim();
      if (!text) {
        setSelOpen(false);
        return;
      }

      const blockId = getSelectionBlockId();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) return;

      setSelText(text.slice(0, 500));
      setSelBlockId(blockId);
      setSelPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
      setSelOpen(true);
    };

    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('touchend', handleSelection, { passive: true });

    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('touchend', handleSelection);
    };
  }, []);

  const togglePanel = (key: Exclude<PanelKey, null>) => {
    setOpenPanel((p) => (p === key ? null : key));
  };

  const markFirstOpenDone = () => {
    window.localStorage.setItem(firstOpenKey, '1');
  };

  const onStartReading = () => {
    markFirstOpenDone();
    setOpenPanel(null);
  };

  const onAddHighlight = () => {
    const quote = selText.trim();
    if (!quote) return;
    const blockId = selBlockId ?? getNearestBlockIdToViewportTop() ?? blocks[0]?.id;
    if (!blockId) return;

    setHighlights((prev) => [{ id: `h-${safeId()}`, blockId, quote, createdAt: new Date().toISOString() }, ...prev]);

    setSelOpen(false);

    const sel = window.getSelection();
    sel?.removeAllRanges();
  };

  const onAskCoachFromSelection = () => {
    setOpenPanel('coach');
    setSelOpen(false);
  };

  const onJumpToChapter = (ch: Chapter) => {
    setOpenPanel(null);
    scrollToBlock(ch.blockId);
  };

  const onJumpToHighlight = (h: Highlight) => {
    setOpenPanel(null);
    scrollToBlock(h.blockId);
  };

  const canPrev = pageNumber > 1;
  const canNext = pageNumber < totalPages;
  const prevPage = Math.max(1, pageNumber - 1);
  const nextPage = Math.min(totalPages, pageNumber + 1);
  const makePageHref = (page: number) => `/reader/${book.id}?page=${page}`;

  return (
    <div className="min-h-screen w-full bg-linear-to-b from-black via-slate-950 to-black">
      <div className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Button href="/library" leftIcon={<IoChevronBackOutline />}>
            Library
          </Button>

          <button type="button" onClick={() => togglePanel('overview')} className="ml-1 min-w-0 flex-1 text-left" title="Open overview">
            <div className="truncate text-sm font-semibold text-white">{book.title}</div>
            <div className="truncate text-xs text-slate-400">{book.author ?? '-'}</div>
          </button>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">
              <Button href={makePageHref(prevPage)} disabled={!canPrev} leftIcon={<IoChevronBackOutline />}>
                Prev
              </Button>
              <div className="text-xs text-slate-400">
                Page {pageNumber} / {totalPages}
              </div>
              <Button href={makePageHref(nextPage)} disabled={!canNext} rightIcon={<IoChevronForwardOutline />}>
                Next
              </Button>
            </div>
            {TOOL_BUTTONS.map(({ key, icon: Icon, title }) => (
              <SquareButton key={key} title={title} onClick={() => togglePanel(key)}>
                <Icon />
              </SquareButton>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl gap-0 px-4 py-6">
        <div className="min-w-0 flex-1">
          <div
            className="mx-auto h-[calc(100vh-140px)]"
            style={{
              maxWidth: contentWidth,
              fontSize,
              lineHeight,
            }}
          >
            <div className="h-full space-y-4 overflow-y-auto pr-2 pb-24">
              {blocks.map((b) => (
                <p
                  key={b.id}
                  id={b.id}
                  data-block-id={b.id}
                  className={clsx(
                    'rounded-xl px-3 py-2 text-slate-100/95',
                    b.text.toUpperCase() === b.text && b.text.length < 60 && 'font-semibold text-slate-200',
                    'selection:bg-slate-200/20',
                  )}
                >
                  {b.text}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden w-95 shrink-0 pl-4 lg:block">
          <SidePanel
            openPanel={openPanel}
            book={book}
            progressPct={progressPct}
            chapters={book.chapters}
            highlights={highlights}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchHits={searchHits}
            onClose={() => setOpenPanel(null)}
            onStartReading={onStartReading}
            onJumpToChapter={onJumpToChapter}
            onJumpToHighlight={onJumpToHighlight}
            settings={{
              fontSize,
              setFontSize,
              lineHeight,
              setLineHeight,
              contentWidth,
              setContentWidth,
            }}
          />
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 pb-8 md:hidden">
        <Button href={makePageHref(prevPage)} disabled={!canPrev} leftIcon={<IoChevronBackOutline />}>
          Prev
        </Button>
        <div className="text-xs text-slate-400">
          Page {pageNumber} / {totalPages}
        </div>
        <Button href={makePageHref(nextPage)} disabled={!canNext} rightIcon={<IoChevronForwardOutline />}>
          Next
        </Button>
      </div>

      <BottomSheet open={!!openPanel} title={panelTitle(openPanel)} onClose={() => setOpenPanel(null)}>
        <PanelBody
          openPanel={openPanel}
          book={book}
          progressPct={progressPct}
          chapters={book.chapters}
          highlights={highlights}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchHits={searchHits}
          onStartReading={onStartReading}
          onJumpToChapter={onJumpToChapter}
          onJumpToHighlight={onJumpToHighlight}
          settings={{
            fontSize,
            setFontSize,
            lineHeight,
            setLineHeight,
            contentWidth,
            setContentWidth,
          }}
        />
      </BottomSheet>

      {selOpen && selPos && (
        <SelectionToolbar
          x={selPos.x}
          y={selPos.y}
          onClose={() => setSelOpen(false)}
          onHighlight={onAddHighlight}
          onAskCoach={onAskCoachFromSelection}
        />
      )}
    </div>
  );
}
