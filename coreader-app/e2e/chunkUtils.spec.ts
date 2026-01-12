import { expect, test } from '@playwright/test';
import { chunkToBlocks, fallbackBlocks } from '../app/reader/[bookId]/chunkUtils';
import type { EntityDescription } from '../app/reader/[bookId]/types';

test('converts chunk text and applies entity offsets', () => {
  const text = 'Alice went home.\nShe met Bob there.';
  const entities = [
    { entityId: 'ent1', name: 'Bob', type: 'person', startOffsets: [25] },
    { entityId: 'ent2', name: 'Alice', type: 'person', startOffsets: [0] },
  ];

  const description: EntityDescription = { id: 'ent1', nameCanonical: 'Bob', type: 'person', descriptionCurrent: 'Loves coding.' };
  const blocks = chunkToBlocks(text, 0, entities, new Map([[description.id, description]]));

  expect(blocks).toHaveLength(1);
  const [block] = blocks;
  expect(block.text).toBe('Alice went home. She met Bob there.');
  expect(block.entities).toBeDefined();
  expect(block.entities?.length).toBe(2);

  const bob = block.entities?.find((e) => e.entityId === 'ent1');
  expect(bob?.start).toBe(25);
  expect(bob?.length).toBe(3);
  expect(bob?.description?.descriptionCurrent).toBe('Loves coding.');

  const alice = block.entities?.find((e) => e.entityId === 'ent2');
  expect(alice?.start).toBe(0);
  expect(alice?.length).toBe(5);
});

test('uses fallback blocks when no content', () => {
  const blocks = chunkToBlocks('', 3);
  const fallback = fallbackBlocks(3);

  expect(blocks).toEqual(fallback);
  expect(fallback[0].id).toBe('b-3-0');
});
