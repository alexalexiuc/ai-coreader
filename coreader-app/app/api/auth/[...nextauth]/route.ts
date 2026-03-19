import NextAuth, { type AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { verifyPassword } from '@/lib/auth/utils';
import { findUserByEmail } from '@/lib/db/users';

// Configure cookies to work across all alexiuc.dev subdomains so that the
// NextAuth session token can be read by the MCP server at mcp.alexiuc.dev.
// Set NEXTAUTH_COOKIE_DOMAIN=.alexiuc.dev in production; leave it unset for
// local development.
const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;
const cookiePrefix = useSecureCookies ? '__Secure-' : '';
const cookieDomain = process.env.NEXTAUTH_COOKIE_DOMAIN;

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await findUserByEmail(credentials.email);
        if (!user) return null;
        const isValid = await verifyPassword(credentials.password, user.passwordHash);
        if (!isValid) return null;
        const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
        return { id: user._id.toHexString(), email: user.email, name: displayName };
      },
    }),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // First sign-in: persist id + email into the JWT
        token.id = user.id;
        token.email = user.email as string;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.email = token.email;
      return session;
    },
  },

  pages: {
    signIn: '/auth/signin',
  },

  ...(cookieDomain && {
    cookies: {
      sessionToken: {
        name: `${cookiePrefix}next-auth.session-token`,
        options: {
          httpOnly: true,
          sameSite: 'lax' as const,
          path: '/',
          secure: useSecureCookies,
          domain: cookieDomain,
        },
      },
    },
  }),
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
