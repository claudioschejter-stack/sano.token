import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import authConfig from './auth.config';
import { verifyCredentials } from './lib/auth/credentialsService';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
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
  ]
});
