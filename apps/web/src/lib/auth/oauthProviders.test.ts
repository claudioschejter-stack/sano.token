import { afterEach, describe, expect, it } from 'vitest';
import {
  buildOAuthProviders,
  getEnabledOAuthProviders,
  isAppleOAuthConfigured,
  isGoogleOAuthConfigured,
  resolveOAuthCallbackUrl
} from './oauthProviders';

describe('oauthProviders', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('detects configured Google OAuth env vars', () => {
    delete process.env.AUTH_GOOGLE_ID;
    delete process.env.AUTH_GOOGLE_SECRET;
    expect(isGoogleOAuthConfigured()).toBe(false);

    process.env.AUTH_GOOGLE_ID = 'google-client-id';
    process.env.AUTH_GOOGLE_SECRET = 'google-client-secret';
    expect(isGoogleOAuthConfigured()).toBe(true);
    expect(getEnabledOAuthProviders()).toEqual(['google']);
    expect(buildOAuthProviders()).toHaveLength(1);
  });

  it('detects configured Apple OAuth env vars', () => {
    process.env.AUTH_APPLE_ID = 'apple-service-id';
    process.env.AUTH_APPLE_SECRET = 'apple-client-secret';
    expect(isAppleOAuthConfigured()).toBe(true);
    expect(getEnabledOAuthProviders()).toEqual(['apple']);
  });

  it('builds OAuth callback URLs from site URL', () => {
    expect(resolveOAuthCallbackUrl('google', 'https://www.sanovacapital.com/')).toBe(
      'https://www.sanovacapital.com/api/auth/callback/google'
    );
    expect(resolveOAuthCallbackUrl('apple', 'https://www.sanovacapital.com')).toBe(
      'https://www.sanovacapital.com/api/auth/callback/apple'
    );
  });
});
