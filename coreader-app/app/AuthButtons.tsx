'use client';

import { useState } from 'react';
import { LoginModal } from '@/app/auth/LoginModal';
import { RegisterModal } from '@/app/auth/RegisterModal';

export function AuthButtons({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  if (variant === 'compact') {
    return (
      <>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRegisterModal(true)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
          >
            Sign up
          </button>
          <button
            onClick={() => setShowLoginModal(true)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
          >
            Log in
          </button>
        </div>

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
  }

  return (
    <>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => setShowRegisterModal(true)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-center text-sm text-slate-200 hover:bg-slate-700"
        >
          Create account
        </button>
        <button
          onClick={() => setShowLoginModal(true)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-center text-sm text-slate-200 hover:bg-slate-700"
        >
          Log in
        </button>
      </div>

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
}
