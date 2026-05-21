import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import type { SystemRole } from './lib/auth/roles';
import { verifyCredentials } from './lib/auth/credentialsService';

type AuthToken = {
  accessToken?: string;
  role?: SystemRole;
  roles?: SystemRole[];
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== 'string' || typeof password !== 'string') {
          return null;
        }

        try {
          const result = await verifyCredentials(email, password);
          if (!result) {
            return null;
          }

          return {
            id: result.id,
            email: result.email,
            role: result.role,
            roles: result.roles,
            accessToken: result.accessToken
          };
        } catch (error) {
          console.error('[auth] credentials login failed:', error);
          return null;
        }
      }
    })
  ],
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
});
