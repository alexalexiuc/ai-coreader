export type PanelKey = 'overview' | 'toc' | 'search' | 'coach' | 'highlights' | 'settings' | null;

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

export type Block = {
  id: string; // used as DOM id for scrolling
  text: string;
  chapterId?: string;
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
