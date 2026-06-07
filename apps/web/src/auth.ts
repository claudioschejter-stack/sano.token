import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import authConfig from './auth.config';
import { verifyCredentials } from './lib/auth/credentialsService';
import { verifyPasskeyLoginToken } from './lib/auth/passkeyService';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: 'passkey',
      name: 'passkey',
      credentials: {
        loginToken: { label: 'Login Token', type: 'text' }
      },
      async authorize(credentials) {
        const loginToken = credentials?.loginToken;
        if (typeof loginToken !== 'string' || !loginToken.trim()) {
          return null;
        }

        try {
          const result = await verifyPasskeyLoginToken(loginToken.trim());
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
          console.error('[auth] passkey login failed:', error);
          return null;
        }
      }
    }),
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
