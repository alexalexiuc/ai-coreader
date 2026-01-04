import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, setSessionCookie } from '@/lib/auth/cookies';
import { findUserById, updateUserPassword } from '@/lib/db/users';
import { validatePasswordChange, hashNewPassword } from '@/lib/auth/password';
import { deleteAllUserSessions, createSession } from '@/lib/auth/sessions';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword, passwordConfirmation } = body;

    // Validate inputs
    if (!currentPassword || typeof currentPassword !== 'string') {
      return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json({ error: 'New password is required' }, { status: 400 });
    }

    if (!passwordConfirmation || typeof passwordConfirmation !== 'string') {
      return NextResponse.json({ error: 'Password confirmation is required' }, { status: 400 });
    }

    // Get user with password hash
    const user = await findUserById(currentUser.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Validate password change
    const validation = await validatePasswordChange(currentPassword, newPassword, passwordConfirmation, user.passwordHash);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Hash new password
    const newPasswordHash = await hashNewPassword(newPassword);

    // Update password in database
    await updateUserPassword(user._id, newPasswordHash);

    // Invalidate all existing sessions
    await deleteAllUserSessions(user._id);

    // Create new session for current user
    const token = await createSession(user._id);
    await setSessionCookie(token);

    return NextResponse.json({ message: 'Password changed successfully' });
  } catch (error: any) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
