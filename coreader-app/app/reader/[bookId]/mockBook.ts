import type { Block, Book } from './types';

export const MOCK_BOOK: Book = {
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

export const MOCK_BLOCKS: Block[] = [
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
    text: "The Commission's questions were simple. His answers had to be simpler.",
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
