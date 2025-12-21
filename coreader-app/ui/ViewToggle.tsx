import clsx from 'clsx';

type Option<T> = {
  key: T;
  label?: string | React.ReactNode;
  Icon?: React.ComponentType<{ className?: string; size?: number }>;
  ariaLabel?: string;
};

type ViewToggleProps<T> = {
  value: T;
  onChange: (v: T) => void;
  options: readonly Option<T>[];
  className?: string;
};

export function ViewToggle<T extends string>({
  value,
  onChange,
  options,
  className,
}: ViewToggleProps<T>) {
  return (
    <div
      className={clsx(
        'inline-flex rounded-xl border border-slate-800 bg-slate-950/70 p-1',
        className,
      )}
    >
      {options.map((opt) => {
        const active = value === opt.key;
        const Icon = opt.Icon;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={clsx(
              'inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition',
              active ? 'bg-slate-900 text-white' : 'text-slate-300 hover:text-white',
            )}
            aria-pressed={active}
            aria-label={opt.ariaLabel}
          >
            {Icon ? <Icon /> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
