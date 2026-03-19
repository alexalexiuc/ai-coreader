import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { SignInPage } from './SignInPage';

/**
 * Allowed callback hosts for the OAuth flow.
 * Validated server-side before the page is rendered so that the client
 * component never receives an unsafe callbackUrl.
 */
const ALLOWED_CALLBACK_HOSTS = ['hub.alexiuc.dev', 'mcp.alexiuc.dev', 'localhost'];

function isSafeCallbackUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    const isHttps = url.protocol === 'https:';
    const isLocalHttp = url.protocol === 'http:' && url.hostname === 'localhost';
    if (!isHttps && !isLocalHttp) return false;
    return ALLOWED_CALLBACK_HOSTS.some((allowed) => url.hostname === allowed);
  } catch {
    return false;
  }
}

interface SignInServerPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SignInServerPage({ searchParams }: SignInServerPageProps) {
  const params = await searchParams;
  const rawCallback = typeof params.callbackUrl === 'string' ? params.callbackUrl : undefined;

  // Validate the callbackUrl to prevent open redirects
  const callbackUrl = rawCallback && isSafeCallbackUrl(rawCallback) ? rawCallback : '/';

  // If the user already has a valid NextAuth session, skip the login form
  const session = await getServerSession(authOptions);
  if (session) {
    redirect(callbackUrl);
  }

  return <SignInPage callbackUrl={callbackUrl} />;
}
