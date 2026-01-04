import { NextRequest, NextResponse } from 'next/server';
import { createUser, findUserByEmail } from '@/lib/db/users';
import { hashPassword, isValidEmail, isValidPassword } from '@/lib/auth/utils';
import { createSession } from '@/lib/auth/sessions';
import { setSessionCookie } from '@/lib/auth/cookies';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, firstName, lastName } = body;

    // Validate inputs
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const user = await createUser({
      email,
      passwordHash,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
    });

    // Create session
    const token = await createSession(new ObjectId(user.id));
    await setSessionCookie(token);

    return NextResponse.json(
      { user },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Registration error:', error);
    
    // Handle duplicate email error from MongoDB
    if (error?.code === 11000) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to register user' },
      { status: 500 }
    );
  }
}
