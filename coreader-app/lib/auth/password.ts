import { hashPassword, verifyPassword, isValidPassword } from './utils';

export interface PasswordChangeResult {
  success: boolean;
  error?: string;
}

/**
 * Validate password change request
 */
export async function validatePasswordChange(
  currentPassword: string,
  newPassword: string,
  passwordConfirmation: string,
  currentPasswordHash: string,
): Promise<PasswordChangeResult> {
  // Validate current password
  const isCurrentValid = await verifyPassword(currentPassword, currentPasswordHash);
  if (!isCurrentValid) {
    return { success: false, error: 'Current password is incorrect' };
  }

  // Validate new password format
  if (!isValidPassword(newPassword)) {
    return { success: false, error: 'New password must be at least 8 characters' };
  }

  // Validate password confirmation matches
  if (newPassword !== passwordConfirmation) {
    return { success: false, error: 'Password confirmation does not match' };
  }

  // Ensure new password is different from current
  const isSamePassword = await verifyPassword(newPassword, currentPasswordHash);
  if (isSamePassword) {
    return { success: false, error: 'New password must be different from current password' };
  }

  return { success: true };
}

/**
 * Hash a new password securely
 */
export async function hashNewPassword(password: string): Promise<string> {
  return hashPassword(password);
}
