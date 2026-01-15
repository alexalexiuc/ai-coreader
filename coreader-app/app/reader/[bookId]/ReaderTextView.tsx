'use client';

import clsx from 'clsx';
import { useMemo, useState } from 'react';
import type { Block, BlockEntity } from './types';
import { Button } from '@/ui/Button';
import { IoChevronBackOutline, IoChevronForwardOutline } from 'react-icons/io5';
import { EntityPopup } from './EntityPopup';

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
  const [activeEntity, setActiveEntity] = useState<{ entity: BlockEntity; anchorElement: HTMLElement } | null>(null);

  const onEntityClick = (entity: BlockEntity, element: HTMLElement) => {
    setActiveEntity({
      entity,
      anchorElement: element,
    });
  };

  const closePopup = () => setActiveEntity(null);

  const hasPages = totalPages > 0;
  const canPrev = hasPages && pageNumber > 1;
  const canNext = hasPages && pageNumber < totalPages;
  const prevPage = Math.max(1, pageNumber - 1);
  const nextPage = Math.min(totalPages, pageNumber + 1);
  const makePageHref = (page: number) => `/reader/${bookId}?page=${page}`;

  const sideButtonWidthPx = 56;
  const containerGapPx = 12; // gap-3
  const containerMaxWidth = contentWidth + sideButtonWidthPx * 2 + containerGapPx * 2;

  return (
    <>
      <div
        className="mx-auto h-[calc(100vh-140px)]"
        style={{
          maxWidth: containerMaxWidth,
        }}
      >
        <div className="grid h-full grid-cols-[56px_minmax(0,1fr)_56px] gap-3">
          <Button
            href={makePageHref(prevPage)}
            disabled={!canPrev}
            aria-label="Previous page"
            title="Previous page"
            paddingClass="p-0"
            textSizeClass="text-3xl"
            className="h-full w-14 rounded-2xl text-slate-200"
            leftIcon={<IoChevronBackOutline />}
          />

          <div
            className="h-full"
            style={{
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
                  <BlockContent
                    block={b}
                    onHover={setHoveredEntityId}
                    hoveredEntityId={hoveredEntityId}
                    activeEntityId={activeEntity?.entity.id ?? null}
                    onEntityClick={onEntityClick}
                  />
                </p>
              ))}
            </div>
          </div>

          <Button
            href={makePageHref(nextPage)}
            disabled={!canNext}
            aria-label="Next page"
            title="Next page"
            paddingClass="p-0"
            textSizeClass="text-3xl"
            className="h-full w-14 rounded-2xl text-slate-200"
            rightIcon={<IoChevronForwardOutline />}
          />
        </div>
      </div>

      {activeEntity && (
        <EntityPopup
          entity={activeEntity.entity}
          anchorElement={activeEntity.anchorElement}
          isOpen={true}
          onClose={closePopup}
        />
      )}
    </>
  );
}

type BlockContentProps = {
  block: Block;
  hoveredEntityId: string | null;
  activeEntityId: string | null;
  onHover: (entityId: string | null) => void;
  onEntityClick: (entity: BlockEntity, element: HTMLElement) => void;
};

function BlockContent({ block, hoveredEntityId, activeEntityId, onHover, onEntityClick }: BlockContentProps) {
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
            isActive={hoveredEntityId === segment.entity.id || activeEntityId === segment.entity.id}
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
  const entities = [...(block.entities ?? [])].sort((a, b) => a.start - b.start);
  let cursor = 0;

  for (const entity of entities) {
    const start = Math.max(cursor, Math.min(entity.start, block.text.length));
    const end = Math.max(start, Math.min(entity.start + entity.length, block.text.length));

    if (start > cursor) {
      segments.push({ key: `${block.id}:text:${cursor}`, type: 'text', text: block.text.slice(cursor, start) });
    }

    if (end > start) {
      const normalizedEntity: BlockEntity = { ...entity, start, length: end - start };
      segments.push({
        key: `${block.id}:entity:${entity.id}`,
        type: 'entity',
        text: block.text.slice(start, end),
        entity: normalizedEntity,
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
  onClick: (entity: BlockEntity, element: HTMLElement) => void;
};

function EntityToken({ segment, isActive, onHover, onClick }: EntityTokenProps) {
  return (
    <span
      data-entity-id={segment.entity.id}
      className={clsx(
        'cursor-pointer rounded-sm px-0.5 underline decoration-amber-400/40 decoration-dotted underline-offset-2 transition-colors',
        isActive
          ? 'bg-amber-400/30 text-amber-50 decoration-amber-300/80'
          : 'text-slate-100 hover:bg-amber-300/20 hover:text-amber-50 hover:decoration-amber-300/80',
      )}
      onMouseEnter={() => onHover(segment.entity.id)}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => onClick(segment.entity, e.currentTarget)}
      title={`${segment.entity.name} (${segment.entity.type})`}
    >
      {segment.text}
    </span>
  );
}


