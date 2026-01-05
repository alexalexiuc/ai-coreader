'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getCurrentUserAction, loginAction, logoutAction, registerAction } from '@/app/auth/actions';

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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const result = await getCurrentUserAction();
      if (result.error) {
        throw new Error(result.error);
      }
      setUser(result.user ?? null);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    const result = await loginAction(email, password);
    if (result.error) {
      throw new Error(result.error);
    }
    if (!result.user) {
      throw new Error('Failed to login');
    }
    setUser(result.user);
  };

  const register = async (email: string, password: string, firstName?: string, lastName?: string) => {
    const result = await registerAction({ email, password, firstName, lastName });
    if (result.error) {
      throw new Error(result.error);
    }
    if (!result.user) {
      throw new Error('Failed to register');
    }
    setUser(result.user);
  };

  const logout = async () => {
    const result = await logoutAction();
    if (result.error) {
      throw new Error(result.error);
    }
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
