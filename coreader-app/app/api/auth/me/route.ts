import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/cookies';

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('Get current user error:', error);
    return NextResponse.json({ error: 'Failed to get current user' }, { status: 500 });
  }
}
