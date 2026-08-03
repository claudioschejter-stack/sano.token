/**
 * Shared constants for Sanova → Privy Custom JWT Auth.
 *
 * Privy verifies `/api/auth/privy-token` JWTs using either:
 * - JWKS at `/api/auth/privy-jwks` (must be reachable by Privy's servers), or
 * - an X.509 certificate / public key configured in the Privy Dashboard.
 *
 * kid `sanova-rwa-v2` was rotated after production JWT signatures failed to
 * verify against the previous JWKS public key (Invalid Signature / invalid_credentials).
 */

import { privyAppId } from './config';

export const PRIVY_CUSTOM_AUTH_JWT_KID = 'sanova-rwa-v2';

/** Default issuer must match what is configured in Privy JWT-based auth (if set). */
export const PRIVY_CUSTOM_AUTH_JWT_ISSUER_DEFAULT = 'https://www.sanovacapital.com';

/**
 * Canonical JWKS URL that bypasses Cloudflare on the custom domain.
 * Prefer this in Privy Dashboard — not www.sanovacapital.com.
 */
export const PRIVY_CUSTOM_AUTH_JWKS_URL_VERCEL =
  'https://sano-token-web.vercel.app/api/auth/privy-jwks';

/** Public verification key matching kid `sanova-rwa-v2` (not a secret). */
export const PRIVY_CUSTOM_AUTH_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAquEgdW4+WiT1dhqVHUI/
g0UzqewEf4Fo4Lbfvq9eg+vvZ/B06tKBjIRymbFTuixRdT84EgRzDFm6qtl+dw1+
d1sBAhilYyrq0T1xTVCRAl2P82R8+3IDlQsCeTmpQKiopLkjPoP2/T2M5LtlSY2C
dkYJk9PPbLQbJB5wC1IjWisQMVusWS0lgyZO01L6elkyOfh07ViKpSa5RGJ4fs2w
wjFCn3PklljhYAfp1pnsjggwh+W6X4ovPIv/GRaA2HXFOmOCQjR3Ug8yQ1bmpT86
Oy0IbM2BD93QIysn0iKCiZHzDlTJovmB1hqb3BMP6/f0SQ9uuoqIFB+UdIV0tnxg
MwIDAQAB
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
