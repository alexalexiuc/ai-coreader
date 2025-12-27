export function safeId() {
  return Math.random().toString(36).slice(2);
}

export function getSelectionText() {
  if (typeof window === 'undefined') return '';
  const sel = window.getSelection();
  if (!sel) return '';
  return sel.toString();
}

// Finds the closest block container for current selection.
export function getSelectionBlockId(): string | null {
  if (typeof window === 'undefined') return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const node = range.commonAncestorContainer as Node | null;
  if (!node) return null;

  const el = (node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement) as Element | null;
  if (!el) return null;

  const blockEl = el.closest?.('[data-block-id]') as HTMLElement | null;
  return blockEl?.dataset?.blockId ?? null;
}

export function scrollToBlock(blockId: string) {
  const el = document.getElementById(blockId);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}

export function getNearestBlockIdToViewportTop(): string | null {
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
