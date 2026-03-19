import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/cookies';
import { SignInPage } from './SignInPage';

/**
 * Explicit allowlist of trusted hosts for the callbackUrl.
 * Using exact host matching rather than wildcard suffix matching avoids
 * an open-redirect risk from any unexpected subdomain under alexiuc.dev.
 * Add new trusted hosts here as new services are introduced.
 */
const ALLOWED_CALLBACK_HOSTS = ['hub.alexiuc.dev', 'mcp.alexiuc.dev', 'localhost'];

function isSafeCallbackUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    // Only allow https (or http on localhost for development)
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

  // If the user is already authenticated, redirect them straight to the callback
  const user = await getCurrentUser();
  if (user) {
    redirect(callbackUrl);
  }

  return <SignInPage callbackUrl={callbackUrl} />;
}
