'use server';

import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';
import { getCurrentUser, setSessionCookie, clearSessionCookie } from '@/lib/auth/cookies';
import { createSession, deleteSession } from '@/lib/auth/sessions';
import { hashPassword, isValidEmail, isValidPassword, verifyPassword } from '@/lib/auth/utils';
import { createUser, findUserByEmail } from '@/lib/db/users';
import type { User } from '@/app/contexts/AuthContext';

interface AuthActionResult {
  user?: User | null;
  error?: string;
}

export async function getCurrentUserAction(): Promise<AuthActionResult> {
  try {
    const user = await getCurrentUser();
    return { user };
  } catch (error) {
    console.error('Get current user error:', error);
    return { error: 'Failed to get current user' };
  }
}

export async function loginAction(email?: string, password?: string): Promise<AuthActionResult> {
  try {
    if (!email || typeof email !== 'string') {
      return { error: 'Email is required' };
    }

    if (!password || typeof password !== 'string') {
      return { error: 'Password is required' };
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return { error: 'Invalid email or password' };
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return { error: 'Invalid email or password' };
    }

    const token = await createSession(user._id);
    await setSessionCookie(token);

    const userDTO: User = {
      id: user._id.toHexString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt.toISOString(),
    };

    return { user: userDTO };
  } catch (error) {
    console.error('Login error:', error);
    return { error: 'Failed to login' };
  }
}

export async function registerAction(params: {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
}): Promise<AuthActionResult> {
  try {
    const { email, password, firstName, lastName } = params;

    if (!email || typeof email !== 'string') {
      return { error: 'Email is required' };
    }

    if (!isValidEmail(email)) {
      return { error: 'Invalid email format' };
    }

    if (!password || typeof password !== 'string') {
      return { error: 'Password is required' };
    }

    if (!isValidPassword(password)) {
      return { error: 'Password must be at least 8 characters' };
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return { error: 'Email already registered' };
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser({
      email,
      passwordHash,
      firstName: firstName?.trim() || undefined,
      lastName: lastName?.trim() || undefined,
    });

    const token = await createSession(new ObjectId(user.id));
    await setSessionCookie(token);

    return { user };
  } catch (error: any) {
    console.error('Registration error:', error);
    if (error?.code === 11000) {
      return { error: 'Email already registered' };
    }
    return { error: 'Failed to register user' };
  }
}

export async function logoutAction(): Promise<AuthActionResult> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    if (token) {
      await deleteSession(token);
    }
    await clearSessionCookie();

    return { user: null };
  } catch (error) {
    console.error('Logout error:', error);
    return { error: 'Failed to logout' };
  }
}
