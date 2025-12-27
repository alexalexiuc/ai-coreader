'use client';

import { clamp } from '@/lib/number';
import clsx from 'clsx';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IoBookmarkOutline,
  IoChevronBackOutline,
  IoInformationCircleOutline,
  IoListOutline,
  IoOptionsOutline,
  IoSearchOutline,
  IoSparklesOutline,
} from 'react-icons/io5';
import { BottomSheet, PanelBody, SidePanel, panelTitle } from './ReaderPanels';
import { SelectionToolbar } from './SelectionToolbar';
import { MOCK_BLOCKS, MOCK_BOOK } from './mockBook';
import { getNearestBlockIdToViewportTop, getSelectionBlockId, getSelectionText, safeId, scrollToBlock } from './readerUtils';
import type { Chapter, Highlight, PanelKey, SearchHit } from './types';
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

export default function ReaderPage() {
  const book = MOCK_BOOK;
  const blocks = MOCK_BLOCKS;

  const [openPanel, setOpenPanel] = useState<PanelKey>(null);

  const [fontSize, setFontSize] = useState(18); // px
  const [lineHeight, setLineHeight] = useState(1.7);
  const [contentWidth, setContentWidth] = useState(720); // px

  const contentRef = useRef<HTMLDivElement | null>(null);
  const [progressPct, setProgressPct] = useState(0);

  const firstOpenKey = `cr:firstOpenDone:${book.id}`;
  const lastPosKey = `cr:lastPos:${book.id}`;

  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [pinned, setPinned] = useState(false);

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
    } else {
      const lastBlockId = typeof window !== 'undefined' ? window.localStorage.getItem(lastPosKey) : null;
      if (lastBlockId) {
        setTimeout(() => scrollToBlock(lastBlockId), 50);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const el = contentRef.current;
      if (!el) return;

      const doc = document.documentElement;
      const scrollTop = doc.scrollTop || document.body.scrollTop;
      const viewportH = window.innerHeight || doc.clientHeight;

      const contentTop = el.getBoundingClientRect().top + scrollTop;
      const contentH = el.offsetHeight;

      const within = clamp((scrollTop + viewportH * 0.2 - contentTop) / Math.max(1, contentH), 0, 1);
      setProgressPct(Math.round(within * 100));

      const nearest = getNearestBlockIdToViewportTop();
      if (nearest) {
        window.localStorage.setItem(lastPosKey, nearest);
      }
    };

    let raf = 0;
    const onScrollRaf = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(onScroll);
    };

    window.addEventListener('scroll', onScrollRaf, { passive: true });
    onScrollRaf();
    return () => {
      window.removeEventListener('scroll', onScrollRaf);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <div className="min-h-screen w-full bg-linear-to-b from-black via-slate-950 to-black">
      <div className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Button href="/library" leftIcon={<IoChevronBackOutline />}>
            Library
          </Button>

          <button type="button" onClick={() => togglePanel('overview')} className="ml-1 min-w-0 flex-1 text-left" title="Open overview">
            <div className="truncate text-sm font-semibold text-white">{book.title}</div>
            <div className="truncate text-xs text-slate-400">{book.author ?? 'ƒ?"'}</div>
          </button>

          <div className="flex items-center gap-2">
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
            className="mx-auto"
            style={{
              maxWidth: contentWidth,
              fontSize,
              lineHeight,
            }}
          >
            <div ref={contentRef} className="space-y-4 pb-24">
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

function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 p-2 text-slate-200 hover:border-slate-700"
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}
