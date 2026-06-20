import type { Provider } from 'next-auth/providers';
import Apple from 'next-auth/providers/apple';
import Google from 'next-auth/providers/google';

export type OAuthProviderId = 'google' | 'apple';

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID?.trim() && process.env.AUTH_GOOGLE_SECRET?.trim());
}

export function isAppleOAuthConfigured(): boolean {
  return Boolean(process.env.AUTH_APPLE_ID?.trim() && process.env.AUTH_APPLE_SECRET?.trim());
}

export function getEnabledOAuthProviders(): OAuthProviderId[] {
  const enabled: OAuthProviderId[] = [];

  if (isGoogleOAuthConfigured()) {
    enabled.push('google');
  }

  if (isAppleOAuthConfigured()) {
    enabled.push('apple');
  }

  return enabled;
}

export function buildOAuthProviders(): Provider[] {
  const providers: Provider[] = [];

  if (isGoogleOAuthConfigured()) {
    providers.push(
      Google({
        clientId: process.env.AUTH_GOOGLE_ID!.trim(),
        clientSecret: process.env.AUTH_GOOGLE_SECRET!.trim()
      })
    );
  }

  if (isAppleOAuthConfigured()) {
    providers.push(
      Apple({
        clientId: process.env.AUTH_APPLE_ID!.trim(),
        clientSecret: process.env.AUTH_APPLE_SECRET!.trim()
      })
    );
  }

  return providers;
}

export function resolveOAuthCallbackUrl(provider: OAuthProviderId, siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, '');
  return `${base}/api/auth/callback/${provider}`;
}
