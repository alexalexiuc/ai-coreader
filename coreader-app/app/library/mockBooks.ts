import type { LibraryBook } from './types';

export const MOCK_BOOKS: LibraryBook[] = [
  {
    id: '1',
    title: 'Foundation',
    author: 'Isaac Asimov',
    source: 'uploaded',
    addedAt: '2025-12-02T10:20:00.000Z',
    lastOpenedAt: '2025-12-18T20:10:00.000Z',
    progressPct: 38,
    isPinned: true,
  },
  {
    id: '2',
    title: 'I, Robot',
    author: 'Isaac Asimov',
    source: 'uploaded',
    addedAt: '2025-12-10T13:00:00.000Z',
    lastOpenedAt: '2025-12-11T18:40:00.000Z',
    progressPct: 12,
  },
  {
    id: '3',
    title: 'Dune',
    author: 'Frank Herbert',
    source: 'shop',
    addedAt: '2025-12-15T09:10:00.000Z',
    progressPct: 0,
  },
  {
    id: '4',
    title: 'The Martian Chronicles',
    author: 'Ray Bradbury',
    source: 'shop',
    addedAt: '2025-11-28T09:10:00.000Z',
    progressPct: 100,
    lastOpenedAt: '2025-12-01T07:10:00.000Z',
  },
];
