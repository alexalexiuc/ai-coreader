'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { registerAction } from '@/app/auth/actions';

interface SignInPageProps {
  callbackUrl: string;
}

type View = 'login' | 'register';

export function SignInPage({ callbackUrl }: SignInPageProps) {
  const [view, setView] = useState<View>('login');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register state
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Use a full-page navigation so the browser follows cross-domain redirects
  // required by the OAuth flow (callbackUrl may be on a different origin).
  const redirectToCallback = () => {
    window.location.href = callbackUrl;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const result = await signIn('credentials', {
        email: loginEmail,
        password: loginPassword,
        redirect: false,
      });
      if (result?.error) {
        setLoginError('Invalid email or password');
      } else {
        redirectToCallback();
      }
    } catch {
      setLoginError('Failed to sign in');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegLoading(true);
    try {
      // Step 1: create the user in the database
      const result = await registerAction({
        email: regEmail,
        password: regPassword,
        firstName: regFirstName || undefined,
        lastName: regLastName || undefined,
      });
      if (result.error) {
        setRegError(result.error);
        return;
      }
      // Step 2: sign in via NextAuth so a session cookie is created
      const signInResult = await signIn('credentials', {
        email: regEmail,
        password: regPassword,
        redirect: false,
      });
      if (signInResult?.error) {
        setRegError('Account created successfully. Please sign in with your credentials.');
        setView('login');
        return;
      }
      redirectToCallback();
    } catch {
      setRegError('Failed to create account');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg bg-gray-900 p-8 shadow-xl">
        {view === 'login' ? (
          <>
            <h2 className="mb-2 text-2xl font-bold text-white">Sign in</h2>
            <p className="mb-6 text-sm text-gray-400">Sign in to continue to AI Co-Reader</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-300">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-300">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>

              {loginError && (
                <div className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full rounded-md bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {loginLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-400">
              Don&apos;t have an account?{' '}
              <button onClick={() => setView('register')} className="font-semibold text-blue-500 hover:text-blue-400">
                Register
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-2 text-2xl font-bold text-white">Create account</h2>
            <p className="mb-6 text-sm text-gray-400">Register to continue to AI Co-Reader</p>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="reg-email" className="mb-2 block text-sm font-medium text-gray-300">
                  Email *
                </label>
                <input
                  type="email"
                  id="reg-email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label htmlFor="reg-password" className="mb-2 block text-sm font-medium text-gray-300">
                  Password * <span className="text-xs text-gray-500">(min 8 characters)</span>
                </label>
                <input
                  type="password"
                  id="reg-password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-firstName" className="mb-2 block text-sm font-medium text-gray-300">
                    First Name
                  </label>
                  <input
                    type="text"
                    id="reg-firstName"
                    value={regFirstName}
                    onChange={(e) => setRegFirstName(e.target.value)}
                    className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="John"
                  />
                </div>

                <div>
                  <label htmlFor="reg-lastName" className="mb-2 block text-sm font-medium text-gray-300">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="reg-lastName"
                    value={regLastName}
                    onChange={(e) => setRegLastName(e.target.value)}
                    className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Doe"
                  />
                </div>
              </div>

              {regError && (
                <div className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {regError}
                </div>
              )}

              <button
                type="submit"
                disabled={regLoading}
                className="w-full rounded-md bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {regLoading ? 'Creating account...' : 'Register'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-400">
              Already have an account?{' '}
              <button onClick={() => setView('login')} className="font-semibold text-blue-500 hover:text-blue-400">
                Sign in
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
