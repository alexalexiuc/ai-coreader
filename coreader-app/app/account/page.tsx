import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/cookies';
import { AccountClientPage } from './AccountClientPage';

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/');
  }

  return <AccountClientPage user={user} />;
}
