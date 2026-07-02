import type { NextAuthConfig } from 'next-auth';
import type { SystemRole } from './lib/auth/roles';

type AuthToken = {
  accessToken?: string;
  role?: SystemRole;
  roles?: SystemRole[];
  accountOperational?: boolean;
  totpPending?: boolean;
  pendingTotpToken?: string;
};

export default {
  providers: [],
  pages: {
    signIn: '/acceso',
    error: '/acceso'
  },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 30,   // 30 days
    updateAge: 60 * 60 * 24      // refresh token once per day on activity
  },
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as {
          id?: string;
          role?: SystemRole;
          roles?: SystemRole[];
          accessToken?: string;
        };

        if (authUser.id) {
          token.sub = authUser.id;
        }

        token.accessToken = authUser.accessToken;
        token.role = authUser.role;
        token.roles = authUser.roles;
        token.email = user.email;

        const enrichedUser = user as {
          accountOperational?: boolean;
          totpPending?: boolean;
          pendingTotpToken?: string;
        };

        if (enrichedUser.totpPending) {
          token.totpPending = true;
          token.pendingTotpToken = enrichedUser.pendingTotpToken;
          token.accessToken = undefined;
          token.accountOperational = false;
        } else if (typeof enrichedUser.accountOperational === 'boolean') {
          token.accountOperational = enrichedUser.accountOperational;
        }
      }

      return token;
    },
    async session({ session, token }) {
      const authToken = token as AuthToken & { authError?: string; sub?: string };

      if (session.user) {
        session.user.id = authToken.sub;
        session.user.role = authToken.role;
        session.user.roles = authToken.roles;
        session.user.accessToken = authToken.accessToken;
        session.user.email = token.email ?? session.user.email;
        session.user.accountOperational = authToken.accountOperational;
        session.user.totpPending = authToken.totpPending;
        session.user.pendingTotpToken = authToken.pendingTotpToken;
      }

      session.authError = authToken.authError;
      return session;
    }
  },
  trustHost: true
} satisfies NextAuthConfig;
