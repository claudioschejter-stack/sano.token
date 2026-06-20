import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import authConfig from './auth.config';
import { verifyCredentials } from './lib/auth/credentialsService';
import { verifyPasskeyLoginToken } from './lib/auth/passkeyService';
import { handleOAuthLogin } from './lib/auth/oauthService';
import { buildOAuthProviders } from './lib/auth/oauthProviders';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    ...buildOAuthProviders(),
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
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, account }) {
      if (
        account &&
        (account.provider === 'google' || account.provider === 'apple') &&
        user?.email
      ) {
        try {
          const result = await handleOAuthLogin({
            email: user.email,
            name: user.name,
            image: user.image,
            provider: account.provider,
            providerAccountId: String(
              account.providerAccountId ?? account.id ?? user.id ?? ''
            )
          });

          token.sub = result.id;
          token.accessToken = result.accessToken;
          token.role = result.role;
          token.roles = result.roles;
          token.email = user.email;
          return token;
        } catch (error) {
          token.authError =
            error instanceof Error && error.message === 'INVESTOR_ACCESS_NOT_ENABLED'
              ? 'AccessDenied'
              : 'auth';
          return token;
        }
      }

      return authConfig.callbacks.jwt!({ token, user });
    }
  }
});
