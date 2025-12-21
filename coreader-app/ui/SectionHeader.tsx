import clsx from 'clsx';

export type SectionHeaderProps = {
  label?: string;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  titleSize?: 'sm' | 'lg' | 'xl' | '3xl';
  spaceBetween?: boolean;
  className?: string;
};

const getTitleSizeClass = (size: 'sm' | 'lg' | 'xl' | '3xl') => {
  switch (size) {
    case 'sm':
      return 'text-sm';
    case 'lg':
      return 'text-lg';
    case 'xl':
      return 'text-xl';
    case '3xl':
      return 'text-3xl';
  }
};

export const SectionHeader = ({
  label,
  title,
  description,
  actions,
  titleSize = '3xl',
  spaceBetween = true,
  className,
}: SectionHeaderProps) => {
  return (
    <div
      className={clsx(
        'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div>
        {label && <p className="text-xs tracking-[0.25em] text-slate-500 uppercase">{label}</p>}
        {title && (
          <h1
            className={clsx(
              'font-bold text-white',
              label && spaceBetween && 'mt-2',
              getTitleSizeClass(titleSize),
            )}
          >
            {title}
          </h1>
        )}
        {description && (
          <p
            className={clsx(
              label && title && spaceBetween && 'mt-2',
              'max-w-2xl text-sm text-slate-400',
            )}
          >
            {description}
          </p>
        )}
      </div>

      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
};
