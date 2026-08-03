import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PRIVY_CUSTOM_AUTH_JWT_ISSUER_DEFAULT,
  PRIVY_CUSTOM_AUTH_JWKS_URL_VERCEL,
  resolvePrivyCustomAuthJwtAudience,
  resolvePrivyCustomAuthJwtIssuer,
  resolvePrivyJwtPrivateKeyPem
} from './privyCustomAuthJwt';

describe('privyCustomAuthJwt', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults issuer to www (not apex) so Dashboard and JWT match production origin', () => {
    expect(resolvePrivyCustomAuthJwtIssuer()).toBe(PRIVY_CUSTOM_AUTH_JWT_ISSUER_DEFAULT);
    expect(PRIVY_CUSTOM_AUTH_JWT_ISSUER_DEFAULT).toBe('https://www.sanovacapital.com');
  });

  it('allows PRIVY_JWT_ISSUER override and strips trailing slash', () => {
    vi.stubEnv('PRIVY_JWT_ISSUER', 'https://sanovacapital.com/');
    expect(resolvePrivyCustomAuthJwtIssuer()).toBe('https://sanovacapital.com');
  });

  it('uses NEXT_PUBLIC_PRIVY_APP_ID as audience when set', () => {
    vi.stubEnv('NEXT_PUBLIC_PRIVY_APP_ID', 'app-from-env');
    expect(resolvePrivyCustomAuthJwtAudience()).toBe('app-from-env');
  });

  it('prefers PRIVY_JWT_AUDIENCE over app id', () => {
    vi.stubEnv('NEXT_PUBLIC_PRIVY_APP_ID', 'app-from-env');
    vi.stubEnv('PRIVY_JWT_AUDIENCE', 'custom-aud');
    expect(resolvePrivyCustomAuthJwtAudience()).toBe('custom-aud');
  });

  it('restores literal \\n in PRIVY_JWT_PRIVATE_KEY', () => {
    vi.stubEnv('PRIVY_JWT_PRIVATE_KEY', '-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----');
    expect(resolvePrivyJwtPrivateKeyPem()).toBe(
      '-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----'
    );
  });

  it('documents Vercel JWKS URL that bypasses Cloudflare', () => {
    expect(PRIVY_CUSTOM_AUTH_JWKS_URL_VERCEL).toContain('sano-token-web.vercel.app');
    expect(PRIVY_CUSTOM_AUTH_JWKS_URL_VERCEL).toContain('/api/auth/privy-jwks');
  });
});
