export type PanelKey = 'overview' | 'toc' | 'entities' | 'search' | 'coach' | 'highlights' | 'settings' | null;

export type Chapter = {
  id: string;
  title: string;
  blockId: string; // anchor block id to scroll to
};

export type Book = {
  id: string;
  title: string;
  author?: string;
  description?: string;
  chapters: Chapter[];
};

export type EntityDescription = {
  id: string;
  nameCanonical: string;
  type: string;
  aliases?: string[];
  descriptionCurrent?: string;
  keyFacts?: string[];
  uncertainties?: string[];
};

export type PageEntity = {
  entityId: string;
  name: string;
  type: string;
  mentionCount: number;
  firstBlockId: string;
  description?: EntityDescription;
};

export type BlockEntity = {
  id: string;
  entityId: string;
  name: string;
  type: string;
  start: number;
  length: number;
  description?: EntityDescription;
};

export type Block = {
  id: string; // used as DOM id for scrolling
  text: string;
  chapterId?: string;
  entities?: BlockEntity[];
};

export type Highlight = {
  id: string;
  blockId: string;
  quote: string;
  createdAt: string; // ISO
};

export type SearchHit = {
  id: string;
  blockId: string;
  snippet: string;
};

export type ReaderSettings = {
  fontSize: number;
  setFontSize: (v: number) => void;
  lineHeight: number;
  setLineHeight: (v: number) => void;
  contentWidth: number;
  setContentWidth: (v: number) => void;
};
