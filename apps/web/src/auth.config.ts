import type { NextAuthConfig } from 'next-auth';
import type { SystemRole } from './lib/auth/roles';

type AuthToken = {
  accessToken?: string;
  role?: SystemRole;
  roles?: SystemRole[];
};

export default {
  providers: [],
  pages: {
    signIn: '/acceso',
    error: '/acceso'
  },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 12
  },
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as {
          role?: SystemRole;
          roles?: SystemRole[];
          accessToken?: string;
        };

        token.accessToken = authUser.accessToken;
        token.role = authUser.role;
        token.roles = authUser.roles;
        token.email = user.email;
      }

      return token;
    },
    async session({ session, token }) {
      const authToken = token as AuthToken & { authError?: string };

      if (session.user) {
        session.user.role = authToken.role;
        session.user.roles = authToken.roles;
        session.user.accessToken = authToken.accessToken;
        session.user.email = token.email ?? session.user.email;
      }

      session.authError = authToken.authError;
      return session;
    }
  },
  trustHost: true
} satisfies NextAuthConfig;
