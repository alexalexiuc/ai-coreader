import clsx from 'clsx';
import type { ReactNode } from 'react';
import { IoCloseOutline, IoFlashOutline, IoSearchOutline } from 'react-icons/io5';
import { formatRelativeDate } from '@/lib/date';
import { scrollToBlock } from './readerUtils';
import type { Book, Chapter, Highlight, PageEntity, PanelKey, ReaderSettings, SearchHit } from './types';
import { SquareButton } from '@/ui/SquareButton';
import { Section } from '@/ui/Section';
import { SectionHeader } from '@/ui/SectionHeader';
import { Badge } from '@/ui/Badge';

type SidePanelProps = {
  openPanel: PanelKey;
  book: Book;
  progressPct: number;
  chapters: Chapter[];
  highlights: Highlight[];
  pageEntities: PageEntity[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  searchHits: SearchHit[];
  onClose: () => void;
  onStartReading: () => void;
  onJumpToChapter: (ch: Chapter) => void;
  onJumpToHighlight: (h: Highlight) => void;
  settings: ReaderSettings;
};

export function SidePanel(props: SidePanelProps) {
  if (!props.openPanel) {
    return null;
    // return (
    //   <Section paddingClass="p-4">
    //     <div className="text-sm text-slate-400">
    //       <p className="font-semibold text-slate-200">Tools</p>
    //       <p className="mt-1">
    //         Open <span className="text-slate-200">Entities</span>, <span className="text-slate-200">TOC</span>,{' '}
    //         <span className="text-slate-200">Search</span>, <span className="text-slate-200">Coach</span>, or{' '}
    //         <span className="text-slate-200">Highlights</span>.
    //       </p>
    //       <p className="mt-3 text-xs text-slate-500">Tip: Ctrl/Cmd + K opens search.</p>
    //     </div>
    //   </Section>
    // );
  }

  return (
    <div className="sticky top-18">
      <Section paddingClass="">
        <SectionHeader
          title={panelTitle(props.openPanel)}
          titleSize="sm"
          className="px-4 py-2"
          actions={
            <SquareButton onClick={props.onClose} title="Close">
              <IoCloseOutline />
            </SquareButton>
          }
        />
        <div className="border-b border-slate-800" />

        <div className="max-h-[calc(100vh-130px)] overflow-auto p-3">
          <PanelBody {...props} />
        </div>
        {/* </div> */}
      </Section>
    </div>
  );
}

type PanelBodyProps = Omit<SidePanelProps, 'onClose'>;

export function PanelBody(props: PanelBodyProps) {
  switch (props.openPanel) {
    case 'overview':
      return <OverviewPanel book={props.book} progressPct={props.progressPct} onStart={props.onStartReading} />;
    case 'toc':
      return <TocPanel chapters={props.chapters} onJump={props.onJumpToChapter} />;
    case 'entities':
      return <EntitiesPanel entities={props.pageEntities} />;
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

export function panelTitle(p: PanelKey) {
  switch (p) {
    case 'overview':
      return 'Overview';
    case 'toc':
      return 'Chapters';
    case 'entities':
      return 'Entities';
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

export function BottomSheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className={clsx('fixed inset-0 z-40 lg:hidden', open ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!open}>
      {/* Backdrop */}
      <div className={clsx('absolute inset-0 transition', open ? 'bg-black/50' : 'bg-black/0')} onClick={onClose} />

      {/* Sheet */}
      <div
        className={clsx(
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

function OverviewPanel({ book, progressPct, onStart }: { book: Book; progressPct: number; onStart: () => void }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs tracking-[0.25em] text-slate-500 uppercase">Book</p>
        <h3 className="mt-2 text-xl font-semibold text-white">{book.title}</h3>
        <p className="mt-1 text-sm text-slate-400">{book.author ?? '-'}</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Progress</p>
          <span className="text-sm text-slate-300">{progressPct}%</span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full border border-slate-800 bg-slate-900/60">
          <div className="h-full rounded-full bg-slate-200/70" style={{ width: `${progressPct}%` }} />
        </div>
        <button
          type="button"
          onClick={onStart}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 hover:border-slate-700"
        >
          <IoFlashOutline />
          {progressPct > 0 ? 'Resume reading' : 'Start reading'}
        </button>
        <p className="mt-2 text-xs text-slate-500">Tip: you can always open this overview by clicking the book title.</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
        <p className="text-sm font-semibold text-white">Description</p>
        <p className="mt-2 text-sm text-slate-300">{book.description ?? '-'}</p>
      </div>
    </div>
  );
}

function TocPanel({ chapters, onJump }: { chapters: Chapter[]; onJump: (ch: Chapter) => void }) {
  const hasChapters = chapters.length > 0;
  return (
    <div>
      <p className="text-sm font-semibold text-white">Chapters</p>
      {!hasChapters ? (
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">No chapters detected.</div>
      ) : (
        <div className="mt-3 space-y-2">
          {chapters.map((ch) => {
            const isClickable = typeof ch.pageNumber === 'number' || !!ch.blockId;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => onJump(ch)}
                disabled={!isClickable}
                className={clsx(
                  'w-full rounded-xl border px-4 py-3 text-left text-sm',
                  isClickable
                    ? 'border-slate-800 bg-slate-950/50 text-slate-200 hover:border-slate-700'
                    : 'cursor-not-allowed border-slate-900 bg-slate-950/30 text-slate-500',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate">{ch.title}</span>
                  {typeof ch.pageNumber === 'number' && Number.isFinite(ch.pageNumber) && ch.pageNumber > 0 && (
                    <span className="shrink-0 text-[11px] text-slate-500">p. {ch.pageNumber}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
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
          placeholder="Type to search..."
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
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">No matches found.</div>
        )}
      </div>
    </div>
  );
}

function CoachPanel() {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-white">Coach</p> <Badge>Soon</Badge>
        <p className="mt-1 text-xs text-slate-500">This panel is a placeholder. Wire it to your chat + RAG backend.</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
        <p className="font-semibold text-white">Quick prompts</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {['Summarize this chapter', 'Explain this paragraph', 'Who is the main character so far?', 'What are the key ideas here?'].map(
            (t) => (
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
            ),
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <p className="text-sm font-semibold text-white">Chat</p>
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/30 p-3 text-sm text-slate-400">Messages UI goes here.</div>

        <div className="mt-3 flex gap-2">
          <input
            placeholder="Ask something about the book?"
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

function EntitiesPanel({ entities }: { entities: PageEntity[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Entities on this page</p>
          <p className="mt-1 text-xs text-slate-500">Click an entity to jump to its first mention.</p>
        </div>
        <Badge>{entities.length}</Badge>
      </div>

      {entities.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
          No entities detected on this page yet.
        </div>
      ) : (
        <div className="space-y-2">
          {entities.map((entity) => (
            <button
              key={entity.entityId}
              type="button"
              onClick={() => scrollToBlock(entity.firstBlockId)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-left hover:border-slate-700"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-100">{entity.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge colorClass="border-amber-400/30 bg-amber-500/10 text-amber-100">{entity.type}</Badge>
                    <Badge>
                      {entity.mentionCount} mention{entity.mentionCount === 1 ? '' : 's'}
                    </Badge>
                  </div>
                </div>
              </div>

              {entity.description?.descriptionCurrent ? (
                <p className="mt-2 line-clamp-3 text-sm text-slate-300">{entity.description.descriptionCurrent}</p>
              ) : (
                <p className="mt-2 text-xs text-slate-500">No description available yet.</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HighlightsPanel({ highlights, onJump }: { highlights: Highlight[]; onJump: (h: Highlight) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-white">Highlights</p>
        <p className="mt-1 text-xs text-slate-500">Saved passages you can jump back to.</p>
      </div>

      {highlights.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
          No highlights yet. Select text and press <span className="text-slate-200">Highlight</span>.
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
              <span className="mt-2 block text-[11px] text-slate-500">{formatRelativeDate(h.createdAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsPanel(props: ReaderSettings) {
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
          <li>* Esc: close panels / selection toolbar</li>
          <li>* Ctrl/Cmd + K: open search</li>
        </ul>
      </div>
    </div>
  );
}

function SettingRow({ label, value, children }: { label: string; value: string; children: ReactNode }) {
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
