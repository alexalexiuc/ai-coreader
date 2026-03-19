import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getUserById, UserDTO } from '../db/users';

/**
 * Get current authenticated user from the NextAuth session.
 * All server actions and route handlers call this to obtain the acting user.
 */
export async function getCurrentUser(): Promise<UserDTO | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }
  return getUserById(session.user.id);
}
