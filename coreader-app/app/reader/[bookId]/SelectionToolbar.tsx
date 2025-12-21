import { IoCloseOutline } from 'react-icons/io5';

type SelectionToolbarProps = {
  x: number;
  y: number;
  onClose: () => void;
  onHighlight: () => void;
  onAskCoach: () => void;
};

export function SelectionToolbar({ x, y, onClose, onHighlight, onAskCoach }: SelectionToolbarProps) {
  return (
    <div
      className="fixed z-50"
      style={{
        left: Math.max(12, x - 140),
        top: Math.max(12, y - 52),
      }}
    >
      <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/90 px-3 py-2 shadow-xl shadow-black/40 backdrop-blur">
        <button
          type="button"
          onClick={onHighlight}
          className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-700"
        >
          Highlight
        </button>
        <button
          type="button"
          onClick={onAskCoach}
          className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-700"
        >
          Ask coach
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-800 bg-slate-900/50 p-2 text-slate-200 hover:border-slate-700"
          aria-label="Close selection toolbar"
          title="Close"
        >
          <IoCloseOutline />
        </button>
      </div>
    </div>
  );
}
