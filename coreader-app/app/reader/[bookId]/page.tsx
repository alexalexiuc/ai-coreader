'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IoChevronBackOutline,
  IoCloseOutline,
  IoListOutline,
  IoSearchOutline,
  IoSparklesOutline,
  IoBookmarkOutline,
  IoBookmark,
  IoTextOutline,
  IoOptionsOutline,
  IoInformationCircleOutline,
  IoFlashOutline,
} from 'react-icons/io5';

type PanelKey = 'overview' | 'toc' | 'search' | 'coach' | 'highlights' | 'settings' | null;

type Chapter = {
  id: string;
  title: string;
  blockId: string; // anchor block id to scroll to
};

type Book = {
  id: string;
  title: string;
  author?: string;
  description?: string;
  chapters: Chapter[];
};

type Block = {
  id: string; // used as DOM id for scrolling
  text: string;
  chapterId?: string;
};

type Highlight = {
  id: string;
  blockId: string;
  quote: string;
  createdAt: string; // ISO
};

type SearchHit = {
  id: string;
  blockId: string;
  snippet: string;
};

// -------------------- Mock data (replace with API) --------------------
const MOCK_BOOK: Book = {
  id: 'b1',
  title: 'Foundation',
  author: 'Isaac Asimov',
  description:
    'A classic of science fiction. The story of Hari Seldon and psychohistory — a science that can predict the future of large populations.',
  chapters: [
    { id: 'c1', title: 'Chapter 1 — The Psychohistorians', blockId: 'b-000' },
    { id: 'c2', title: 'Chapter 2 — The Encyclopedists', blockId: 'b-007' },
    { id: 'c3', title: 'Chapter 3 — The Mayors', blockId: 'b-014' },
  ],
};

const MOCK_BLOCKS: Block[] = [
  { id: 'b-000', chapterId: 'c1', text: 'CHAPTER 1 — THE PSYCHOHISTORIANS' },
  {
    id: 'b-001',
    chapterId: 'c1',
    text: 'Hari Seldon stared into the crowd. The city around him hummed with the quiet confidence of empire.',
  },
  {
    id: 'b-002',
    chapterId: 'c1',
    text: 'He had come to Trantor with a plan that could not be explained in a sentence. Not even in a page.',
  },
  {
    id: 'b-003',
    chapterId: 'c1',
    text: 'Psychohistory was mathematics. But it was also, inevitably, politics.',
  },
  {
    id: 'b-004',
    chapterId: 'c1',
    text: 'The Commission’s questions were simple. His answers had to be simpler.',
  },
  {
    id: 'b-005',
    chapterId: 'c1',
    text: '“You claim,” said the voice, “to predict the fall of the Empire.”',
  },
  {
    id: 'b-006',
    chapterId: 'c1',
    text: 'Seldon smiled. Not because he enjoyed the moment — but because the moment was inevitable.',
  },
  { id: 'b-007', chapterId: 'c2', text: 'CHAPTER 2 — THE ENCYCLOPEDISTS' },
  {
    id: 'b-008',
    chapterId: 'c2',
    text: 'Terminus was a frontier world, a rock on the edge of the galaxy, too small to matter — until it did.',
  },
  {
    id: 'b-009',
    chapterId: 'c2',
    text: 'They built a library first. Then they built a life around it.',
  },
  {
    id: 'b-010',
    chapterId: 'c2',
    text: 'The Encyclopedia Foundation had rules, procedures, committees. And in time: myths.',
  },
  {
    id: 'b-011',
    chapterId: 'c2',
    text: 'The first crisis arrived quietly, as all real crises do. Not with explosions, but with paperwork.',
  },
  {
    id: 'b-012',
    chapterId: 'c2',
    text: 'A neighboring kingdom sent envoys. They smiled too much.',
  },
  {
    id: 'b-013',
    chapterId: 'c2',
    text: 'Someone asked: “What exactly did Seldon plan?” and no one liked the answer.',
  },
  { id: 'b-014', chapterId: 'c3', text: 'CHAPTER 3 — THE MAYORS' },
  {
    id: 'b-015',
    chapterId: 'c3',
    text: 'Salvor Hardin believed in logic — and in the usefulness of being underestimated.',
  },
  {
    id: 'b-016',
    chapterId: 'c3',
    text: 'If people wanted a symbol, he would give them one. But he would never confuse it for truth.',
  },
  {
    id: 'b-017',
    chapterId: 'c3',
    text: 'The trick of leadership, he thought, was choosing which battles to make inevitable.',
  },
];

function formatRelativeDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  const mins = Math.floor(ms / (1000 * 60));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function safeId() {
  return Math.random().toString(36).slice(2);
}

function getSelectionText() {
  if (typeof window === 'undefined') return '';
  const sel = window.getSelection();
  if (!sel) return '';
  return sel.toString();
}

// Finds the closest block container for current selection.
function getSelectionBlockId(): string | null {
  if (typeof window === 'undefined') return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const node = range.commonAncestorContainer as Node | null;
  if (!node) return null;

  const el = (
    node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  ) as Element | null;
  if (!el) return null;

  const blockEl = el.closest?.('[data-block-id]') as HTMLElement | null;
  return blockEl?.dataset?.blockId ?? null;
}

function scrollToBlock(blockId: string) {
  const el = document.getElementById(blockId);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}

// -------------------- Page --------------------
export default function ReaderPage() {
  // In your app this will come from route param (bookId) + API fetch.
  const book = MOCK_BOOK;
  const blocks = MOCK_BLOCKS;

  // Panels
  const [openPanel, setOpenPanel] = useState<PanelKey>(null);

  // Settings
  const [fontSize, setFontSize] = useState(18); // px
  const [lineHeight, setLineHeight] = useState(1.7);
  const [contentWidth, setContentWidth] = useState(720); // px

  // Reading progress (simple MVP estimate based on scroll)
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [progressPct, setProgressPct] = useState(0);

  // First-open behavior (MVP: localStorage per book)
  const firstOpenKey = `cr:firstOpenDone:${book.id}`;
  const lastPosKey = `cr:lastPos:${book.id}`;

  // Highlights (MVP)
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [pinned, setPinned] = useState(false);

  // Search (MVP substring search)
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

  // Selection toolbar
  const [selOpen, setSelOpen] = useState(false);
  const [selText, setSelText] = useState('');
  const [selBlockId, setSelBlockId] = useState<string | null>(null);
  const [selPos, setSelPos] = useState<{ x: number; y: number } | null>(null);

  // Restore first-open / last position
  useEffect(() => {
    const firstOpenDone =
      typeof window !== 'undefined' && window.localStorage.getItem(firstOpenKey) === '1';
    if (!firstOpenDone) {
      setOpenPanel('overview');
    } else {
      // Try to restore last position (if any)
      const lastBlockId =
        typeof window !== 'undefined' ? window.localStorage.getItem(lastPosKey) : null;
      if (lastBlockId) {
        // Defer to allow layout paint
        setTimeout(() => scrollToBlock(lastBlockId), 50);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Progress calculation (scroll based)
  useEffect(() => {
    const onScroll = () => {
      const el = contentRef.current;
      if (!el) return;

      // scroll container is window, so measure document scroll
      const doc = document.documentElement;
      const scrollTop = doc.scrollTop || document.body.scrollTop;
      const viewportH = window.innerHeight || doc.clientHeight;

      const contentTop = el.getBoundingClientRect().top + scrollTop;
      const contentH = el.offsetHeight;

      // Estimate progress within content range
      const within = clamp(
        (scrollTop + viewportH * 0.2 - contentTop) / Math.max(1, contentH),
        0,
        1,
      );
      setProgressPct(Math.round(within * 100));

      // Save nearest block to top as last position (throttled-ish)
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

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // close panel or selection UI
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

  // Selection detection (mouse up / touch end)
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

    setHighlights((prev) => [
      { id: `h-${safeId()}`, blockId, quote, createdAt: new Date().toISOString() },
      ...prev,
    ]);

    setSelOpen(false);

    // Clear selection
    const sel = window.getSelection();
    sel?.removeAllRanges();
  };

  const onAskCoachFromSelection = () => {
    // MVP: open coach and prefill query (you can wire to your chat input state)
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
      {/* Top Bar */}
      <div className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link
            href="/library"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-200 hover:border-slate-700"
          >
            <IoChevronBackOutline />
            Library
          </Link>

          <button
            type="button"
            onClick={() => togglePanel('overview')}
            className="ml-1 min-w-0 flex-1 text-left"
            title="Open overview"
          >
            <div className="truncate text-sm font-semibold text-white">{book.title}</div>
            <div className="truncate text-xs text-slate-400">{book.author ?? '—'}</div>
          </button>

          <button
            type="button"
            onClick={() => togglePanel('toc')}
            className="hidden items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-200 hover:border-slate-700 sm:inline-flex"
            title="Table of contents"
          >
            <span className="text-slate-400">{progressPct}%</span>
            <span className="h-4 w-px bg-slate-800" />
            <span className="text-slate-200">TOC</span>
          </button>

          <div className="flex items-center gap-2">
            <IconBtn onClick={() => togglePanel('toc')} title="Chapters">
              <IoListOutline />
            </IconBtn>
            <IconBtn onClick={() => togglePanel('search')} title="Search (Ctrl/Cmd+K)">
              <IoSearchOutline />
            </IconBtn>
            <IconBtn onClick={() => togglePanel('coach')} title="Coach">
              <IoSparklesOutline />
            </IconBtn>
            <IconBtn onClick={() => togglePanel('highlights')} title="Highlights">
              <IoBookmarkOutline />
            </IconBtn>
            <IconBtn
              onClick={() => setPinned((v) => !v)}
              title={pinned ? 'Unpin book' : 'Pin book'}
            >
              {pinned ? <IoBookmark /> : <IoBookmarkOutline />}
            </IconBtn>
            <IconBtn onClick={() => togglePanel('settings')} title="Reader settings">
              <IoOptionsOutline />
            </IconBtn>
          </div>
        </div>
      </div>

      {/* Main Content + Panel */}
      <div className="mx-auto flex max-w-6xl gap-0 px-4 py-6">
        {/* Reading column */}
        <div className="min-w-0 flex-1">
          <div
            className="mx-auto"
            style={{
              maxWidth: contentWidth,
              fontSize,
              lineHeight,
            }}
          >
            <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-200">
              <div className="flex items-center gap-2 text-slate-300">
                <IoTextOutline className="text-slate-500" />
                <span>Reading</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">{progressPct}%</span>
              </div>
              <button
                type="button"
                onClick={() => togglePanel('overview')}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 hover:border-slate-700"
              >
                <IoInformationCircleOutline />
                Overview
              </button>
            </div>

            <div ref={contentRef} className="space-y-4 pb-24">
              {blocks.map((b) => (
                <p
                  key={b.id}
                  id={b.id}
                  data-block-id={b.id}
                  className={classNames(
                    'rounded-xl px-3 py-2 text-slate-100/95',
                    b.text.toUpperCase() === b.text &&
                      b.text.length < 60 &&
                      'font-semibold text-slate-200',
                    'selection:bg-slate-200/20',
                  )}
                >
                  {b.text}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel (desktop) */}
        <div className="hidden w-[380px] shrink-0 pl-4 lg:block">
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

      {/* Bottom sheet panel (mobile/tablet) */}
      <BottomSheet
        open={!!openPanel}
        title={panelTitle(openPanel)}
        onClose={() => setOpenPanel(null)}
      >
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

      {/* Selection toolbar */}
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

// -------------------- Panel components --------------------

function SidePanel(props: {
  openPanel: PanelKey;
  book: Book;
  progressPct: number;
  chapters: Chapter[];
  highlights: Highlight[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  searchHits: SearchHit[];
  onClose: () => void;
  onStartReading: () => void;
  onJumpToChapter: (ch: Chapter) => void;
  onJumpToHighlight: (h: Highlight) => void;
  settings: {
    fontSize: number;
    setFontSize: (v: number) => void;
    lineHeight: number;
    setLineHeight: (v: number) => void;
    contentWidth: number;
    setContentWidth: (v: number) => void;
  };
}) {
  if (!props.openPanel) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
        <p className="font-semibold text-slate-200">Tools</p>
        <p className="mt-1">
          Open <span className="text-slate-200">TOC</span>,{' '}
          <span className="text-slate-200">Search</span>,{' '}
          <span className="text-slate-200">Coach</span>, or{' '}
          <span className="text-slate-200">Highlights</span>.
        </p>
        <p className="mt-3 text-xs text-slate-500">Tip: Ctrl/Cmd + K opens search.</p>
      </div>
    );
  }

  return (
    <div className="sticky top-[72px]">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl shadow-slate-950/40">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="text-sm font-semibold text-white">{panelTitle(props.openPanel)}</div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-slate-200 hover:border-slate-700"
            aria-label="Close panel"
            title="Close"
          >
            <IoCloseOutline />
          </button>
        </div>

        <div className="max-h-[calc(100vh-130px)] overflow-auto p-4">
          <PanelBody {...props} />
        </div>
      </div>
    </div>
  );
}

function PanelBody(props: {
  openPanel: PanelKey;
  book: Book;
  progressPct: number;
  chapters: Chapter[];
  highlights: Highlight[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  searchHits: SearchHit[];
  onStartReading: () => void;
  onJumpToChapter: (ch: Chapter) => void;
  onJumpToHighlight: (h: Highlight) => void;
  settings: {
    fontSize: number;
    setFontSize: (v: number) => void;
    lineHeight: number;
    setLineHeight: (v: number) => void;
    contentWidth: number;
    setContentWidth: (v: number) => void;
  };
}) {
  switch (props.openPanel) {
    case 'overview':
      return (
        <OverviewPanel
          book={props.book}
          progressPct={props.progressPct}
          onStart={props.onStartReading}
        />
      );
    case 'toc':
      return <TocPanel chapters={props.chapters} onJump={props.onJumpToChapter} />;
    case 'search':
      return (
        <SearchPanel
          query={props.searchQuery}
          setQuery={props.setSearchQuery}
          hits={props.searchHits}
          onJump={(hit) => {
            scrollToBlock(hit.blockId);
          }}
        />
      );
    case 'coach':
      return <CoachPanel />;
    case 'highlights':
      return <HighlightsPanel highlights={props.highlights} onJump={props.onJumpToHighlight} />;
    case 'settings':
      return <SettingsPanel {...props.settings} />;
    default:
      return null;
  }
}

function OverviewPanel({
  book,
  progressPct,
  onStart,
}: {
  book: Book;
  progressPct: number;
  onStart: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs tracking-[0.25em] text-slate-500 uppercase">Book</p>
        <h3 className="mt-2 text-xl font-semibold text-white">{book.title}</h3>
        <p className="mt-1 text-sm text-slate-400">{book.author ?? '—'}</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Progress</p>
          <span className="text-sm text-slate-300">{progressPct}%</span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full border border-slate-800 bg-slate-900/60">
          <div
            className="h-full rounded-full bg-slate-200/70"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <button
          type="button"
          onClick={onStart}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 hover:border-slate-700"
        >
          <IoFlashOutline />
          {progressPct > 0 ? 'Resume reading' : 'Start reading'}
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Tip: you can always open this overview by clicking the book title.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
        <p className="text-sm font-semibold text-white">Description</p>
        <p className="mt-2 text-sm text-slate-300">{book.description ?? '—'}</p>
      </div>
    </div>
  );
}

function TocPanel({ chapters, onJump }: { chapters: Chapter[]; onJump: (ch: Chapter) => void }) {
  return (
    <div>
      <p className="text-sm font-semibold text-white">Chapters</p>
      <div className="mt-3 space-y-2">
        {chapters.map((ch) => (
          <button
            key={ch.id}
            type="button"
            onClick={() => onJump(ch)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-left text-sm text-slate-200 hover:border-slate-700"
          >
            {ch.title}
          </button>
        ))}
      </div>
    </div>
  );
}

function SearchPanel({
  query,
  setQuery,
  hits,
  onJump,
}: {
  query: string;
  setQuery: (v: string) => void;
  hits: SearchHit[];
  onJump: (hit: SearchHit) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-white">Search in book</p>
        <p className="mt-1 text-xs text-slate-500">Find text and jump to matches.</p>
      </div>

      <div className="relative">
        <IoSearchOutline className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type to search…"
          className="w-full rounded-xl border border-slate-800 bg-slate-950/60 py-2 pr-3 pl-10 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-slate-700"
        />
      </div>

      {query.trim() && (
        <p className="text-xs text-slate-400">
          {hits.length} match{hits.length === 1 ? '' : 'es'}
        </p>
      )}

      <div className="space-y-2">
        {hits.slice(0, 30).map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => onJump(h)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-left text-sm text-slate-200 hover:border-slate-700"
          >
            <span className="line-clamp-2 text-slate-300">{h.snippet}</span>
            <span className="mt-1 block text-[11px] text-slate-500">Jump to match</span>
          </button>
        ))}

        {query.trim() && hits.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
            No matches found.
          </div>
        )}
      </div>
    </div>
  );
}

function CoachPanel() {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-white">Coach</p>
        <p className="mt-1 text-xs text-slate-500">
          This panel is a placeholder. Wire it to your chat + RAG backend.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
        <p className="font-semibold text-white">Quick prompts</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            'Summarize this chapter',
            'Explain this paragraph',
            'Who is the main character so far?',
            'What are the key ideas here?',
          ].map((t) => (
            <button
              key={t}
              type="button"
              className="rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs text-slate-200 hover:border-slate-700"
              onClick={() => {
                // hook to chat input
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <p className="text-sm font-semibold text-white">Chat</p>
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/30 p-3 text-sm text-slate-400">
          Messages UI goes here.
        </div>

        <div className="mt-3 flex gap-2">
          <input
            placeholder="Ask something about the book…"
            className="flex-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-slate-700"
          />
          <button
            type="button"
            className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm text-slate-200 hover:border-slate-700"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}

function HighlightsPanel({
  highlights,
  onJump,
}: {
  highlights: Highlight[];
  onJump: (h: Highlight) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-white">Highlights</p>
        <p className="mt-1 text-xs text-slate-500">Saved passages you can jump back to.</p>
      </div>

      {highlights.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
          No highlights yet. Select text and press <span className="text-slate-200">Highlight</span>
          .
        </div>
      ) : (
        <div className="space-y-2">
          {highlights.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => onJump(h)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-left text-sm text-slate-200 hover:border-slate-700"
            >
              <span className="line-clamp-3 text-slate-200">“{h.quote}”</span>
              <span className="mt-2 block text-[11px] text-slate-500">
                {formatRelativeDate(h.createdAt)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsPanel(props: {
  fontSize: number;
  setFontSize: (v: number) => void;
  lineHeight: number;
  setLineHeight: (v: number) => void;
  contentWidth: number;
  setContentWidth: (v: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-white">Reader settings</p>
        <p className="mt-1 text-xs text-slate-500">Tune for comfort.</p>
      </div>

      <SettingRow label="Font size" value={`${props.fontSize}px`}>
        <input
          type="range"
          min={14}
          max={26}
          value={props.fontSize}
          onChange={(e) => props.setFontSize(Number(e.target.value))}
          className="w-full"
        />
      </SettingRow>

      <SettingRow label="Line height" value={props.lineHeight.toFixed(1)}>
        <input
          type="range"
          min={1.4}
          max={2.2}
          step={0.1}
          value={props.lineHeight}
          onChange={(e) => props.setLineHeight(Number(e.target.value))}
          className="w-full"
        />
      </SettingRow>

      <SettingRow label="Content width" value={`${props.contentWidth}px`}>
        <input
          type="range"
          min={520}
          max={980}
          step={20}
          value={props.contentWidth}
          onChange={(e) => props.setContentWidth(Number(e.target.value))}
          className="w-full"
        />
      </SettingRow>

      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-500">
        <p className="text-slate-300">Keyboard</p>
        <ul className="mt-2 space-y-1">
          <li>• Esc: close panels / selection toolbar</li>
          <li>• Ctrl/Cmd + K: open search</li>
        </ul>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">{label}</p>
        <span className="text-sm text-slate-300">{value}</span>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function panelTitle(p: PanelKey) {
  switch (p) {
    case 'overview':
      return 'Overview';
    case 'toc':
      return 'Chapters';
    case 'search':
      return 'Search';
    case 'coach':
      return 'Coach';
    case 'highlights':
      return 'Highlights';
    case 'settings':
      return 'Settings';
    default:
      return '';
  }
}

// -------------------- Bottom sheet --------------------

function BottomSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={classNames(
        'fixed inset-0 z-40 lg:hidden',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        className={classNames('absolute inset-0 transition', open ? 'bg-black/50' : 'bg-black/0')}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={classNames(
          'absolute right-0 bottom-0 left-0 max-h-[80vh] transform transition-transform',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="rounded-t-2xl border border-slate-800 bg-slate-900/95 backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div className="text-sm font-semibold text-white">{title}</div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-slate-200 hover:border-slate-700"
              aria-label="Close panel"
            >
              <IoCloseOutline />
            </button>
          </div>
          <div className="overflow-auto p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

// -------------------- Small components --------------------

function IconBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
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

function SelectionToolbar({
  x,
  y,
  onClose,
  onHighlight,
  onAskCoach,
}: {
  x: number;
  y: number;
  onClose: () => void;
  onHighlight: () => void;
  onAskCoach: () => void;
}) {
  return (
    <div
      className="fixed z-50"
      style={{
        left: Math.max(12, x - 140),
        top: Math.max(12, y - 52),
      }}
    >
      <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/90 px-3 py-2 shadow-xl shadow-black/40 backdrop-blur">
        <button
          type="button"
          onClick={onHighlight}
          className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-700"
        >
          Highlight
        </button>
        <button
          type="button"
          onClick={onAskCoach}
          className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-700"
        >
          Ask coach
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-800 bg-slate-900/50 p-2 text-slate-200 hover:border-slate-700"
          aria-label="Close selection toolbar"
          title="Close"
        >
          <IoCloseOutline />
        </button>
      </div>
    </div>
  );
}

// -------------------- Helpers --------------------

function getNearestBlockIdToViewportTop(): string | null {
  const blocks = Array.from(document.querySelectorAll<HTMLElement>('[data-block-id]'));
  if (blocks.length === 0) return null;

  const top = 90; // below top bar
  let best: { id: string; dist: number } | null = null;

  for (const el of blocks) {
    const r = el.getBoundingClientRect();
    const dist = Math.abs(r.top - top);
    if (!best || dist < best.dist) {
      const id = el.dataset.blockId;
      if (id) best = { id, dist };
    }
  }
  return best?.id ?? null;
}
