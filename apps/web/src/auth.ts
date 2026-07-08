import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@sanova/database';
import authConfig from './auth.config';
import { verifyCredentials } from './lib/auth/credentialsService';
import { bypassesTotpGateForRole } from './lib/auth/adminAuthPolicy';
import { verifyPasskeyLoginToken } from './lib/auth/passkeyService';
import { verifyActivationLoginGrant } from './lib/onboarding/accountActivationService';
import { handleOAuthLogin } from './lib/auth/oauthService';
import { buildOAuthProviders } from './lib/auth/oauthProviders';
import {
  applyOAuthTotpGate,
  loadAccountOperational,
  OAuthTotpLockedError
} from './lib/auth/sessionClaims';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    ...buildOAuthProviders(),
    Credentials({
      id: 'activation',
      name: 'activation',
      credentials: {
        loginToken: { label: 'Login Token', type: 'text' }
      },
      async authorize(credentials) {
        const loginToken = credentials?.loginToken;
        if (typeof loginToken !== 'string' || !loginToken.trim()) {
          return null;
        }

        try {
          const result = await verifyActivationLoginGrant(loginToken.trim());
          if (!result) {
            return null;
          }

          return {
            id: result.id,
            email: result.email,
            role: result.role,
            roles: result.roles,
            accessToken: result.accessToken,
            accountOperational: result.accountOperational
          };
        } catch (error) {
          console.error('[auth] activation login failed:', error);
          return null;
        }
      }
    }),
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
            accessToken: result.accessToken,
            accountOperational: await loadAccountOperational(result.id)
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

          const user = await prisma.user.findUnique({
            where: { id: result.id },
            select: { totpEnabled: true }
          });

          // TOTP-enabled accounts must complete login-verify — except ADMIN (password-only).
          if (user?.totpEnabled && !bypassesTotpGateForRole(result.role)) {
            return null;
          }

          return {
            id: result.id,
            email: result.email,
            role: result.role,
            roles: result.roles,
            accessToken: result.accessToken,
            accountOperational: bypassesTotpGateForRole(result.role)
              ? true
              : await loadAccountOperational(result.id)
          };
        } catch (error) {
          if (error instanceof Error && error.message === 'INVESTOR_ACCESS_NOT_ENABLED') {
            throw error;
          }
          console.error('[auth] credentials login failed:', error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, account, trigger, session }) {
      if (trigger === 'update') {
        if (typeof token.sub === 'string') {
          token.accountOperational = await loadAccountOperational(token.sub);
          const { maybeRefreshSessionAccessToken } = await import('./lib/auth/refreshSessionAccessToken');
          return maybeRefreshSessionAccessToken(token);
        }
        return token;
      }

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

          const gated = await applyOAuthTotpGate(result.id, {
            accessToken: result.accessToken,
            role: result.role,
            roles: result.roles
          });

          token.sub = result.id;
          token.role = gated.role as typeof token.role;
          token.roles = gated.roles as typeof token.roles;
          token.email = user.email;
          token.accessToken = gated.accessToken;
          token.accountOperational = gated.accountOperational;
          token.totpPending = gated.totpPending;
          token.pendingTotpToken = gated.pendingTotpToken;
          token.accessTokenIssuedAt = Date.now();
          return token;
        } catch (error) {
          if (error instanceof OAuthTotpLockedError) {
            token.authError = 'CUENTA_BLOQUEADA';
            return token;
          }

          token.authError =
            error instanceof Error
              ? error.message === 'INVESTOR_ACCESS_NOT_ENABLED'
                ? 'INVESTOR_ACCESS_NOT_ENABLED'
                : error.message === 'REGION_NOT_AVAILABLE'
                  ? 'REGION_NOT_AVAILABLE'
                  : error.message === 'TERMS_NOT_ACCEPTED'
                    ? 'TERMS_NOT_ACCEPTED'
                    : 'auth'
              : 'auth';
          return token;
        }
      }

      return authConfig.callbacks.jwt!({ token, user });
    }
  }
});
