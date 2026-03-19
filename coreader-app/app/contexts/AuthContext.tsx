'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { getCurrentUserAction, registerAction } from '@/app/auth/actions';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName?: string, lastName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [fullUser, setFullUser] = useState<User | null>(null);

  const sessionLoading = status === 'loading';
  // When the NextAuth session changes, fetch the full user profile from the DB
  // so that firstName / lastName / createdAt are available in the context.
  const refreshUser = async () => {
    if (status !== 'authenticated') {
      setFullUser(null);
      return;
    }
    try {
      const result = await getCurrentUserAction();
      setFullUser(result.user ?? null);
    } catch {
      setFullUser(null);
    }
  };

  useEffect(() => {
    if (status !== 'loading') {
      refreshUser();
    }
  // refreshUser is intentionally omitted: it is stable across renders and
  // including it would cause an infinite loop. The effect must only re-run
  // when the NextAuth session status or data changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]);

  const loading = sessionLoading;

  const login = async (email: string, password: string) => {
    const result = await signIn('credentials', { email, password, redirect: false });
    if (result?.error) {
      // next-auth returns a generic error message; present a user-friendly one
      throw new Error('Invalid email or password');
    }
    // Session will update automatically via useSession; refreshUser fires via the effect.
  };

  const register = async (email: string, password: string, firstName?: string, lastName?: string) => {
    const result = await registerAction({ email, password, firstName, lastName });
    if (result.error) {
      throw new Error(result.error);
    }
    const signInResult = await signIn('credentials', { email, password, redirect: false });
    if (signInResult?.error) {
      throw new Error('Account created but sign-in failed');
    }
  };

  const logout = async () => {
    await signOut({ redirect: false });
    setFullUser(null);
  };

  return (
    <AuthContext.Provider value={{ user: fullUser, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
