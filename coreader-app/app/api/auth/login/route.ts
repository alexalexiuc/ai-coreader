import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/db/users';
import { verifyPassword } from '@/lib/auth/utils';
import { createSession } from '@/lib/auth/sessions';
import { setSessionCookie } from '@/lib/auth/cookies';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate inputs
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Create session
    const token = await createSession(user._id);
    await setSessionCookie(token);

    // Return user without password hash
    const userDTO = {
      id: user._id.toHexString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt.toISOString(),
    };

    return NextResponse.json({ user: userDTO });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Failed to login' }, { status: 500 });
  }
}
