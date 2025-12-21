import { clsx } from 'clsx';

type Card = React.PropsWithChildren<{
  header?: React.ReactNode;
  className?: string;
}>;

export const Card: React.FC<Card> = ({ header, children, className }) => {
  return (
    <div
      className={clsx('rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3', className)}
    >
      {header}
      {children}
    </div>
  );
};
