type ErrorBannerProps = {
  message: string;
  title?: string;
};

export function ErrorBanner({ message, title = 'Service unavailable' }: ErrorBannerProps) {
  return (
    <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
      <div className="text-xs uppercase tracking-wide text-rose-200/80">{title}</div>
      <div className="mt-1">{message}</div>
    </div>
  );
}
