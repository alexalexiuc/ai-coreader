import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { IoChevronDownOutline } from 'react-icons/io5';

type Option<T> = {
  key: T;
  label: string;
};

type SelectProps<T> = {
  value: T;
  onChange: (k: T) => void;
  options: Option<T>[];
  className?: string;
  ariaLabel?: string;
};

export function Select<T extends string>({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (evt: MouseEvent) => {
      if (!menuRef.current || menuRef.current.contains(evt.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const active = options.find((o) => o.key === value);

  return (
    <div ref={menuRef} className={clsx('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm transition',
          'border-slate-800 bg-slate-950/70 text-slate-200 hover:border-slate-700 focus:border-slate-700',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? 'Select'}
      >
        <span>{active?.label ?? 'Select'}</span>
        <IoChevronDownOutline
          className={`transition ${open ? 'rotate-180 text-slate-300' : 'text-slate-500'}`}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 left-0 z-10 mt-2 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/95 shadow-lg shadow-black/40 backdrop-blur"
          role="listbox"
        >
          {options.map((o) => {
            const selected = o.key === value;
            return (
              <button
                key={o.key}
                role="option"
                aria-selected={selected}
                className={clsx(
                  'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition',
                  selected
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-200 hover:bg-slate-900/70 hover:text-white',
                )}
                onClick={() => {
                  onChange(o.key);
                  setOpen(false);
                }}
              >
                <span>{o.label}</span>
                {selected && <span className="text-xs text-slate-400">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
