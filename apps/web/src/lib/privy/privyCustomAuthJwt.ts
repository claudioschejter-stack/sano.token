/**
 * Shared constants for Sanova → Privy Custom JWT Auth.
 *
 * Privy verifies `/api/auth/privy-token` JWTs using either:
 * - JWKS at `/api/auth/privy-jwks` (must be reachable by Privy's servers), or
 * - the PEM public key pasted in the Privy Dashboard (preferred when Cloudflare
 *   bot-challenges the custom domain).
 */

import { privyAppId } from './config';

export const PRIVY_CUSTOM_AUTH_JWT_KID = 'sanova-rwa-v1';

/** Default issuer must match what is configured in Privy JWT-based auth (if set). */
export const PRIVY_CUSTOM_AUTH_JWT_ISSUER_DEFAULT = 'https://www.sanovacapital.com';

/**
 * Canonical JWKS URL that bypasses Cloudflare on the custom domain.
 * Prefer this (or the PEM public key) in Privy Dashboard — not www.sanovacapital.com.
 */
export const PRIVY_CUSTOM_AUTH_JWKS_URL_VERCEL =
  'https://sano-token-web.vercel.app/api/auth/privy-jwks';

/** Public verification key matching kid `sanova-rwa-v1` (not a secret). */
export const PRIVY_CUSTOM_AUTH_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAz6saKJBgTVuvLrTNHm+4
xXE0U5I+dT3OG1gbm+goFpzkrX9yb2er70Q4DbLPNdi7pE+g7si5NS9UAL6Peca8
NBP/kW8EYezZPuaXJjZG0UlTSIP4NWO7nhyGF5hD+FRkFsAHMXGITdUspAMAzTDZ
5DPd5hKGw3JoplzCzS0XPTi3vkGugM0gbdQmruprJLpXMQWZmofP-L6KNt3eYlo9
3uIcy1IaDl9o/uso0XqjaPnF4K1P9iuY8oOB+I6N3iLHJB3zNyNRkevcYyCPVPAe
D1+CNalpNtP+P+PCP+6gT8eo//Z+Cd1d2M+2EjetQcSsAGKQmsoafz6w/9yrqBif
8wIDAQAB
-----END PUBLIC KEY-----`;

export function resolvePrivyCustomAuthJwtIssuer(): string {
  const fromEnv = process.env.PRIVY_JWT_ISSUER?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }
  return PRIVY_CUSTOM_AUTH_JWT_ISSUER_DEFAULT;
}

export function resolvePrivyCustomAuthJwtAudience(): string {
  const fromEnv = process.env.PRIVY_JWT_AUDIENCE?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return privyAppId() || 'cmqiztako002p0bjmjiqaebuw';
}

export function resolvePrivyJwtPrivateKeyPem(): string | null {
  const raw = process.env.PRIVY_JWT_PRIVATE_KEY?.trim();
  if (!raw) return null;
  // Env var often stores \n as literal backslash-n; restore real newlines.
  return raw.replace(/\\n/g, '\n');
}
