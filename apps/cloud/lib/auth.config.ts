import type { NextAuthConfig } from 'next-auth';
import { configuredOAuthProviders } from './oauth-providers';

export const authConfig = {
  providers: configuredOAuthProviders(),
  pages: { signIn: '/login' },
  trustHost: true,
  // JWT sessions: same token in middleware (edge) and server components (adapter still stores users/accounts).
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.email = user.email ?? token.email;
        token.name = user.name ?? token.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        if (typeof token.email === 'string') session.user.email = token.email;
        if (typeof token.name === 'string') session.user.name = token.name;
      }
      return session;
    },
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      if (path.startsWith('/dashboard')) {
        return !!auth?.user;
      }
      return true;
    },
  },
} satisfies NextAuthConfig;

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
