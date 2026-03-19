'use server';

import { getCurrentUser } from '@/lib/auth/cookies';
import { hashPassword, isValidEmail, isValidPassword } from '@/lib/auth/utils';
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

    return { user };
  } catch (error) {
    console.error('Registration error:', error);
    return { error: 'Failed to register user' };
  }
}
