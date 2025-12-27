export const PageContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="h-full w-full bg-linear-to-b from-black via-slate-950 to-black">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">{children}</div>
    </div>
  );
};
