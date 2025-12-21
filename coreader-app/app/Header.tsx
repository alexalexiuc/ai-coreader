import Link from 'next/link';
import { IoPersonCircleOutline } from 'react-icons/io5';

export const Header = () => {
  const user = {
    name: 'Guest',
    email: 'guest@example.com',
  };

  return (
    <header className="sticky top-0 z-20 flex w-full items-center justify-between border-b border-gray-800 bg-black/70 px-8 py-4 backdrop-blur">
      <h1 className="text-2xl font-bold text-white">
        <Link href="/">AI Co-Reader 🤓</Link>
      </h1>

      <div className="flex items-center gap-3 rounded-full border border-gray-800 bg-gray-900/70 px-3 py-1 shadow-sm">
        <IoPersonCircleOutline className="h-7 w-7 text-slate-100" />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">{user.name}</p>
          <p className="text-xs text-gray-400">{user.email}</p>
        </div>
      </div>
    </header>
  );
};
