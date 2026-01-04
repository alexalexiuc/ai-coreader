import { cookies } from 'next/headers';
import { getUserFromSession } from './sessions';
import { getUserById, UserDTO } from '../db/users';

const SESSION_COOKIE_NAME = 'session_token';

/**
 * Get current authenticated user from session cookie
 */
export async function getCurrentUser(): Promise<UserDTO | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const userId = await getUserFromSession(token);
  if (!userId) {
    return null;
  }

  return getUserById(userId);
}

/**
 * Set session cookie
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/',
  });
}

/**
 * Clear session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
