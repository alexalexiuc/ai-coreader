import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/cookies';
import { updateUserProfile } from '@/lib/db/users';

export async function GET(_request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ user: currentUser });
  } catch (error: any) {
    console.error('Get profile error:', error);
    return NextResponse.json({ error: 'Failed to get profile' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { firstName, lastName } = body;

    // Validate inputs - allow empty strings to clear values
    if (firstName !== undefined && typeof firstName !== 'string') {
      return NextResponse.json({ error: 'First name must be a string' }, { status: 400 });
    }

    if (lastName !== undefined && typeof lastName !== 'string') {
      return NextResponse.json({ error: 'Last name must be a string' }, { status: 400 });
    }

    // Update profile
    const updates: { firstName?: string; lastName?: string } = {};

    // Handle firstName: allow clearing by setting to undefined, or update with trimmed value
    if (firstName !== undefined) {
      const trimmed = firstName.trim();
      updates.firstName = trimmed || undefined;
    }

    // Handle lastName: allow clearing by setting to undefined, or update with trimmed value
    if (lastName !== undefined) {
      const trimmed = lastName.trim();
      updates.lastName = trimmed || undefined;
    }

    const updatedUser = await updateUserProfile(currentUser.id, updates);

    return NextResponse.json({ user: updatedUser, message: 'Profile updated successfully' });
  } catch (error: any) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
