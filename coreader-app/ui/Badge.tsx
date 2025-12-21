import clsx from 'clsx';

type BadgeProps = React.PropsWithChildren<{
  className?: string;
  colorClass?: string;
  sizeClass?: string;
}>;

export const Badge: React.FC<BadgeProps> = ({ children, className, colorClass, sizeClass }) => {
  return (
    <span
      className={clsx(
        'rounded-full border text-xs',
        colorClass ?? 'border-slate-700 bg-slate-800 text-slate-300',
        sizeClass ?? 'px-2 py-0.5',
        className,
      )}
    >
      {children}
    </span>
  );
};
