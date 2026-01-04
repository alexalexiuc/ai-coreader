'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { IoPersonCircleOutline } from 'react-icons/io5';
import { useAuth } from './contexts/AuthContext';
import { LoginModal } from './auth/LoginModal';
import { RegisterModal } from './auth/RegisterModal';

export const Header = () => {
  const { user, loading, logout } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const handleLogout = async () => {
    try {
      await logout();
      setShowUserMenu(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const displayName = user
    ? user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName || user.lastName || user.email.split('@')[0]
    : 'Guest';

  const displayEmail = user?.email || 'Not logged in';

  return (
    <>
      <header className="sticky top-0 z-20 flex w-full items-center justify-between border-b border-gray-800 bg-black/70 px-8 py-4 backdrop-blur">
        <h1 className="text-2xl font-bold text-white">
          <Link href="/">AI Co-Reader 🤓</Link>
        </h1>

        <div className="relative">
          {loading ? (
            <div className="flex items-center gap-3 rounded-full border border-gray-800 bg-gray-900/70 px-3 py-1 shadow-sm">
              <IoPersonCircleOutline className="h-7 w-7 text-slate-100" />
              <div className="leading-tight">
                <p className="text-sm font-semibold text-white">Loading...</p>
              </div>
            </div>
          ) : user ? (
            <div ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 rounded-full border border-gray-800 bg-gray-900/70 px-3 py-1 shadow-sm transition hover:bg-gray-800"
              >
                <IoPersonCircleOutline className="h-7 w-7 text-slate-100" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-white">{displayName}</p>
                  <p className="text-xs text-gray-400">{displayEmail}</p>
                </div>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg border border-gray-800 bg-gray-900 shadow-xl">
                  <button
                    onClick={handleLogout}
                    className="w-full rounded-lg px-4 py-2 text-left text-sm text-white transition hover:bg-gray-800"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowLoginModal(true)}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Login
              </button>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="rounded-md border border-gray-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                Register
              </button>
            </div>
          )}
        </div>
      </header>

      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onSwitchToRegister={() => {
            setShowLoginModal(false);
            setShowRegisterModal(true);
          }}
        />
      )}

      {showRegisterModal && (
        <RegisterModal
          onClose={() => setShowRegisterModal(false)}
          onSwitchToLogin={() => {
            setShowRegisterModal(false);
            setShowLoginModal(true);
          }}
        />
      )}
    </>
  );
};
