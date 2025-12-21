import clsx from 'clsx';
import Link from 'next/link';
import { Badge } from './Badge';

type ActionCardProps = {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  pathTo: string;
  description?: string;
  badge?: string;
  disabled?: boolean;
  variant?: 'compact' | 'square';
};

export const ActionCard = ({
  icon: Icon,
  label,
  pathTo,
  description,
  badge,
  disabled,
  variant,
}: ActionCardProps) => {
  const content = (
    <div
      className={clsx(
        'flex h-full flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 transition duration-200 hover:-translate-y-1 hover:border-slate-500/60 hover:shadow-lg hover:shadow-slate-900/40',
        variant === 'compact' ? 'px-4 py-3' : 'p-6',
      )}
    >
      {variant === 'compact' ? (
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <Icon /> {label} {badge && <Badge>{badge}</Badge>}
          </div>
          {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800/70 text-slate-100">
              <Icon size={28} />
            </span>
            {badge && <Badge>{badge}</Badge>}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold text-white">{label}</span>
            {description && <p className="text-sm text-slate-400">{description}</p>}
          </div>
        </div>
      )}
    </div>
  );

  if (disabled) {
    return <div className="h-full opacity-60">{content}</div>;
  }

  return (
    <Link href={pathTo} className="h-full">
      {content}
    </Link>
  );
};
