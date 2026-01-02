import type { Block, BlockEntity, EntityDescription } from './types';

export type ChunkEntityRefInput = {
  entityId: string;
  name: string;
  type: string;
  startOffsets: number[];
};

type ParagraphInfo = {
  text: string;
  chunkStart: number;
  chunkEnd: number;
  toDisplayOffset: (chunkOffset: number) => number | null;
};

export function fallbackBlocks(pageIndex: number): Block[] {
  return [{ id: `b-${pageIndex}-0`, text: 'No content available for this page.' }];
}

export function chunkToBlocks(
  text: string,
  pageIndex: number,
  entities: ChunkEntityRefInput[] = [],
  entityDescriptions: Map<string, EntityDescription> = new Map(),
): Block[] {
  const paragraphs = splitIntoParagraphs(text);
  if (paragraphs.length === 0) {
    return fallbackBlocks(pageIndex);
  }

  const blocks: Block[] = [];

  paragraphs.forEach((para, idx) => {
    const blockEntities: BlockEntity[] = [];

    for (const entity of entities) {
      const sortedOffsets = [...entity.startOffsets].sort((a, b) => a - b);
      for (const start of sortedOffsets) {
        if (start < para.chunkStart || start >= para.chunkEnd) continue;

        const displayStart = para.toDisplayOffset(start);
        if (displayStart === null || Number.isNaN(displayStart)) continue;

        const safeLength = Math.max(1, Math.min(entity.name.length, para.text.length - displayStart));
        const description = entityDescriptions.get(entity.entityId);

        blockEntities.push({
          id: `${entity.entityId}:${start}`,
          entityId: entity.entityId,
          name: entity.name,
          type: entity.type,
          start: displayStart,
          length: safeLength,
          description,
        });
      }
    }

    blockEntities.sort((a, b) => a.start - b.start);

    blocks.push({
      id: `b-${pageIndex}-${idx}`,
      text: para.text,
      entities: blockEntities.length > 0 ? blockEntities : undefined,
    });
  });

  return blocks;
}

function splitIntoParagraphs(text: string): ParagraphInfo[] {
  const normalized = text.replace(/\r\n/g, '\n');
  const paragraphs: ParagraphInfo[] = [];

  let cursor = 0;

  while (cursor < normalized.length) {
    const nextBreak = normalized.indexOf('\n\n', cursor);
    const rawEnd = nextBreak === -1 ? normalized.length : nextBreak;
    const rawText = normalized.slice(cursor, rawEnd);

    const trimmed = normalizeParagraph(rawText);
    if (trimmed) {
      const { text: paraText, trimStart, trimEnd, offsetMapper } = trimmed;
      const chunkStart = cursor + trimStart;
      const chunkEnd = cursor + trimEnd;

      paragraphs.push({
        text: paraText,
        chunkStart,
        chunkEnd,
        toDisplayOffset: (chunkOffset: number) => {
          if (chunkOffset < chunkStart || chunkOffset > chunkEnd) return null;
          const relative = Math.min(chunkEnd, chunkOffset) - chunkStart;
          return offsetMapper(relative);
        },
      });
    }

    if (nextBreak === -1) break;

    cursor = rawEnd;
    while (cursor < normalized.length && normalized[cursor] === '\n') {
      cursor += 1;
    }
  }

  return paragraphs;
}

function normalizeParagraph(rawText: string): { text: string; trimStart: number; trimEnd: number; offsetMapper: (rawOffset: number) => number } | null {
  const trimStart = findFirstContentIndex(rawText);
  const trimEnd = findLastContentIndex(rawText);

  if (trimStart === null || trimEnd === null || trimStart >= trimEnd) {
    return null;
  }

  const trimmed = rawText.slice(trimStart, trimEnd);
  const text = trimmed.replace(/\r/g, '').replace(/\n+/g, ' ');

  return {
    text,
    trimStart,
    trimEnd,
    offsetMapper: (rawOffset: number) => mapRawOffsetToDisplay(trimmed, rawOffset),
  };
}

function findFirstContentIndex(text: string): number | null {
  for (let i = 0; i < text.length; i += 1) {
    if (!isWhitespace(text[i])) return i;
  }
  return null;
}

function findLastContentIndex(text: string): number | null {
  for (let i = text.length - 1; i >= 0; i -= 1) {
    if (!isWhitespace(text[i])) return i + 1;
  }
  return null;
}

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t';
}

function mapRawOffsetToDisplay(trimmed: string, rawOffset: number): number {
  let displayLength = 0;
  let i = 0;
  const limit = Math.min(rawOffset, trimmed.length);

  while (i < limit) {
    const ch = trimmed[i];

    if (ch === '\r') {
      i += 1;
      continue;
    }

    if (ch === '\n') {
      while (i < limit && trimmed[i] === '\n') {
        i += 1;
      }
      displayLength += 1;
      continue;
    }

    displayLength += 1;
    i += 1;
  }

  return displayLength;
}
