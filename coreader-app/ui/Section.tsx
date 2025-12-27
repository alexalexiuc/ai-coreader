import clsx from 'clsx';
import { SectionHeader, SectionHeaderProps } from './SectionHeader';

type SectionProps = React.PropsWithChildren<{
  header?: React.ReactNode | SectionHeaderProps;
  className?: string;
  paddingClass?: string;
}>;

const isSectionHeaderProps = (header: React.ReactNode | SectionHeaderProps): header is SectionHeaderProps => {
  return (
    (header as SectionHeaderProps).title !== undefined ||
    (header as SectionHeaderProps).label !== undefined ||
    (header as SectionHeaderProps).description !== undefined ||
    (header as SectionHeaderProps).actions !== undefined
  );
};

export const Section: React.FC<SectionProps> = ({ header, children, className, paddingClass: paddingClass }) => {
  return (
    <section
      className={clsx(
        'rounded-3xl border border-slate-800 bg-slate-900/60 shadow-xl shadow-slate-950/50',
        paddingClass ?? 'px-6 py-7',
        className,
      )}
    >
      {header && (isSectionHeaderProps(header) ? <SectionHeader {...header} /> : header)}
      {children}
    </section>
  );
};
