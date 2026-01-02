'use client';

import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IoChevronBackOutline, IoChevronForwardOutline } from 'react-icons/io5';
import type { Block, BlockEntity } from './types';
import { Button } from '@/ui/Button';

type ReaderTextViewProps = {
  blocks: Block[];
  pageNumber: number;
  totalPages: number;
  bookId: string;
  contentWidth: number;
  fontSize: number;
  lineHeight: number;
};

export function ReaderTextView({ blocks, pageNumber, totalPages, bookId, contentWidth, fontSize, lineHeight }: ReaderTextViewProps) {
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  const [activeEntity, setActiveEntity] = useState<{ entity: BlockEntity; anchor: { x: number; y: number } } | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (popupRef.current && popupRef.current.contains(target)) return;
      if (target.closest('[data-entity-id]')) return;
      setActiveEntity(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onEntityClick = (entity: BlockEntity, rect: DOMRect) => {
    setActiveEntity({
      entity,
      anchor: { x: rect.left + rect.width / 2, y: rect.bottom + 8 },
    });
  };

  const closePopup = () => setActiveEntity(null);

  const hasPages = totalPages > 0;
  const canPrev = hasPages && pageNumber > 1;
  const canNext = hasPages && pageNumber < totalPages;
  const prevPage = Math.max(1, pageNumber - 1);
  const nextPage = Math.min(totalPages, pageNumber + 1);
  const makePageHref = (page: number) => `/reader/${bookId}?page=${page}`;

  return (
    <>
      <div
        className="mx-auto h-[calc(100vh-140px)]"
        style={{
          maxWidth: contentWidth,
          fontSize,
          lineHeight,
        }}
      >
        <div className="h-full space-y-4 overflow-y-auto pr-2">
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
              <BlockContent block={b} onHover={setHoveredEntityId} hoveredEntityId={hoveredEntityId} onEntityClick={onEntityClick} />
            </p>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-6 flex max-w-6xl flex-wrap items-center justify-center gap-3 pb-8">
        <Button href={makePageHref(prevPage)} disabled={!canPrev} leftIcon={<IoChevronBackOutline />}>
          Prev
        </Button>
        <div className="rounded-full border border-slate-800 bg-slate-950/70 px-4 py-1 text-xs text-slate-400">
          {hasPages ? `Page ${pageNumber} / ${totalPages}` : 'Page -'}
          {canNext && ` · Next ${nextPage}`}
        </div>
        <Button href={makePageHref(nextPage)} disabled={!canNext} rightIcon={<IoChevronForwardOutline />}>
          Next
        </Button>
      </div>

      {activeEntity && (
        <div
          ref={popupRef}
          className="fixed z-40 w-80 max-w-[calc(100vw-32px)] rounded-xl border border-amber-400/30 bg-slate-950/95 p-4 text-sm text-slate-100 shadow-2xl shadow-amber-500/10 backdrop-blur"
          style={{ left: activeEntity.anchor.x, top: activeEntity.anchor.y, transform: 'translate(-50%, 0)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-amber-100">{activeEntity.entity.name}</div>
              <div className="text-xs tracking-wide text-amber-200/80 uppercase">{activeEntity.entity.type}</div>
            </div>
            <button
              type="button"
              onClick={closePopup}
              className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800/80 hover:text-slate-100"
            >
              Close
            </button>
          </div>

          {activeEntity.entity.description ? (
            <EntityDetails description={activeEntity.entity.description} />
          ) : (
            <p className="mt-2 text-xs text-slate-400">No extra details available for this entity yet.</p>
          )}
        </div>
      )}
    </>
  );
}

type BlockContentProps = {
  block: Block;
  hoveredEntityId: string | null;
  onHover: (entityId: string | null) => void;
  onEntityClick: (entity: BlockEntity, rect: DOMRect) => void;
};

function BlockContent({ block, hoveredEntityId, onHover, onEntityClick }: BlockContentProps) {
  const segments = useMemo(() => buildSegments(block), [block]);

  return (
    <span className="inline">
      {segments.map((segment) =>
        segment.type === 'text' ? (
          <span key={segment.key}>{segment.text}</span>
        ) : (
          <EntityToken
            key={segment.key}
            segment={segment}
            isActive={hoveredEntityId === segment.entity.entityId}
            onHover={onHover}
            onClick={onEntityClick}
          />
        ),
      )}
    </span>
  );
}

type TextSegment = { key: string; type: 'text'; text: string } | { key: string; type: 'entity'; text: string; entity: BlockEntity };

function buildSegments(block: Block): TextSegment[] {
  const segments: TextSegment[] = [];
  const entities = block.entities ?? [];
  let cursor = 0;

  for (const entity of entities) {
    const start = Math.max(0, Math.min(entity.start, block.text.length));
    const end = Math.max(start, Math.min(entity.start + entity.length, block.text.length));

    if (start > cursor) {
      segments.push({ key: `${block.id}:text:${cursor}`, type: 'text', text: block.text.slice(cursor, start) });
    }

    if (end > start) {
      segments.push({
        key: `${block.id}:entity:${entity.id}`,
        type: 'entity',
        text: block.text.slice(start, end),
        entity,
      });
    }

    cursor = Math.max(cursor, end);
  }

  if (cursor < block.text.length) {
    segments.push({ key: `${block.id}:text:${cursor}`, type: 'text', text: block.text.slice(cursor) });
  }

  if (segments.length === 0) {
    segments.push({ key: `${block.id}:text:0`, type: 'text', text: block.text });
  }

  return segments;
}

type EntityTokenProps = {
  segment: Extract<TextSegment, { type: 'entity' }>;
  isActive: boolean;
  onHover: (entityId: string | null) => void;
  onClick: (entity: BlockEntity, rect: DOMRect) => void;
};

function EntityToken({ segment, isActive, onHover, onClick }: EntityTokenProps) {
  return (
    <span
      data-entity-id={segment.entity.entityId}
      className={clsx(
        'cursor-pointer rounded-sm px-0.5 transition-colors',
        isActive ? 'bg-amber-400/30 text-amber-50' : 'bg-amber-300/15 text-amber-100 hover:bg-amber-400/20',
      )}
      onMouseEnter={() => onHover(segment.entity.entityId)}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => onClick(segment.entity, e.currentTarget.getBoundingClientRect())}
      title={`${segment.entity.name} (${segment.entity.type})`}
    >
      {segment.text}
    </span>
  );
}

function EntityDetails({ description }: { description: NonNullable<BlockEntity['description']> }) {
  return (
    <div className="mt-3 space-y-2 text-sm">
      {description.summary && <p className="text-slate-100">{description.summary}</p>}
      {description.role && (
        <p className="text-slate-200">
          <span className="text-slate-400">Role: </span>
          {description.role}
        </p>
      )}
      {renderList('Traits', description.traits)}
      {renderList('Locations', description.importantLocations)}
      {renderList('Relationships', description.importantRelationships)}
    </div>
  );
}

function renderList(label: string, items?: string[]) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="text-xs tracking-wide text-amber-200/80 uppercase">{label}</div>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-100">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
