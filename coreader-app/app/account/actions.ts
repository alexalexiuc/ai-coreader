'use server';

import { getCurrentUser, setSessionCookie } from '@/lib/auth/cookies';
import { validatePasswordChange, hashNewPassword } from '@/lib/auth/password';
import { createSession, deleteAllUserSessions } from '@/lib/auth/sessions';
import { findUserById, updateUserPassword, updateUserProfile } from '@/lib/db/users';

interface ActionResult {
  message?: string;
  error?: string;
}

export async function updateProfileAction(params: { firstName?: string; lastName?: string }): Promise<ActionResult> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { error: 'Unauthorized' };
    }

    const { firstName, lastName } = params;

    if (firstName !== undefined && typeof firstName !== 'string') {
      return { error: 'First name must be a string' };
    }

    if (lastName !== undefined && typeof lastName !== 'string') {
      return { error: 'Last name must be a string' };
    }

    const updates: { firstName?: string; lastName?: string } = {};

    if (firstName !== undefined) {
      const trimmed = firstName.trim();
      updates.firstName = trimmed || undefined;
    }

    if (lastName !== undefined) {
      const trimmed = lastName.trim();
      updates.lastName = trimmed || undefined;
    }

    await updateUserProfile(currentUser.id, updates);

    return { message: 'Profile updated successfully' };
  } catch (error) {
    console.error('Update profile error:', error);
    return { error: 'Failed to update profile' };
  }
}

export async function changePasswordAction(params: {
  currentPassword?: string;
  newPassword?: string;
  passwordConfirmation?: string;
}): Promise<ActionResult> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { error: 'Unauthorized' };
    }

    const { currentPassword, newPassword, passwordConfirmation } = params;

    if (!currentPassword || typeof currentPassword !== 'string') {
      return { error: 'Current password is required' };
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return { error: 'New password is required' };
    }

    if (!passwordConfirmation || typeof passwordConfirmation !== 'string') {
      return { error: 'Password confirmation is required' };
    }

    const user = await findUserById(currentUser.id);
    if (!user) {
      return { error: 'User not found' };
    }

    const validation = await validatePasswordChange(currentPassword, newPassword, passwordConfirmation, user.passwordHash);
    if (!validation.success) {
      return { error: validation.error || 'Invalid password change' };
    }

    const newPasswordHash = await hashNewPassword(newPassword);
    await updateUserPassword(user._id, newPasswordHash);

    await deleteAllUserSessions(user._id);
    const token = await createSession(user._id);
    await setSessionCookie(token);

    return { message: 'Password changed successfully' };
  } catch (error) {
    console.error('Change password error:', error);
    return { error: 'Failed to change password' };
  }
}
