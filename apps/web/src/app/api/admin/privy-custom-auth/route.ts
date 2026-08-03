/**
 * Admin diagnostic for Privy Custom JWT Auth.
 *
 * Confirms local JWT signing config and whether the JWKS URLs Privy would use
 * are reachable (Cloudflare often bot-challenges the custom domain).
 */

import { NextResponse } from 'next/server';
import { createPrivateKey, createPublicKey } from 'crypto';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import {
  PRIVY_CUSTOM_AUTH_JWT_ISSUER_DEFAULT,
  PRIVY_CUSTOM_AUTH_JWT_KID,
  PRIVY_CUSTOM_AUTH_JWKS_URL_VERCEL,
  PRIVY_CUSTOM_AUTH_PUBLIC_KEY_PEM,
  resolvePrivyCustomAuthJwtAudience,
  resolvePrivyCustomAuthJwtIssuer,
  resolvePrivyJwtPrivateKeyPem
} from '../../../../lib/privy/privyCustomAuthJwt';

export const dynamic = 'force-dynamic';

type ProbeResult = {
  url: string;
  ok: boolean;
  status?: number;
  contentType?: string | null;
  cloudflareChallenge?: boolean;
  hasMatchingKid?: boolean;
  error?: string;
};

async function probeJwks(url: string): Promise<ProbeResult> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000)
    });
    const contentType = res.headers.get('content-type');
    const body = await res.text();
    const cloudflareChallenge =
      res.status === 403 ||
      /just a moment/i.test(body) ||
      /cf-mitigated/i.test(res.headers.get('cf-mitigated') ?? '');

    let hasMatchingKid = false;
    if (res.ok && contentType?.includes('application/json')) {
      try {
        const json = JSON.parse(body) as { keys?: Array<{ kid?: string }> };
        hasMatchingKid = Boolean(json.keys?.some((key) => key.kid === PRIVY_CUSTOM_AUTH_JWT_KID));
      } catch {
        hasMatchingKid = false;
      }
    }

    return {
      url,
      ok: res.ok && hasMatchingKid && !cloudflareChallenge,
      status: res.status,
      contentType,
      cloudflareChallenge,
      hasMatchingKid
    };
  } catch (error) {
    return {
      url,
      ok: false,
      error: error instanceof Error ? error.message : 'PROBE_FAILED'
    };
  }
}

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const privateKeyPem = resolvePrivyJwtPrivateKeyPem();
  const issuer = resolvePrivyCustomAuthJwtIssuer();
  const audience = resolvePrivyCustomAuthJwtAudience();
  const customAuthFlag = process.env.NEXT_PUBLIC_PRIVY_CUSTOM_AUTH === 'true';

  let privateKeyMatchesJwks = false;
  let privateKeyError: string | undefined;
  if (privateKeyPem) {
    try {
      const privateKey = createPrivateKey({ key: privateKeyPem, format: 'pem' });
      const publicFromPrivate = createPublicKey(privateKey);
      const exportedPem = publicFromPrivate.export({ type: 'spki', format: 'pem' }).toString();
      privateKeyMatchesJwks =
        exportedPem.replace(/\s+/g, '') === PRIVY_CUSTOM_AUTH_PUBLIC_KEY_PEM.replace(/\s+/g, '');
    } catch (error) {
      privateKeyError = error instanceof Error ? error.message : 'PRIVATE_KEY_INVALID';
    }
  }

  const [wwwJwks, apexJwks, vercelJwks] = await Promise.all([
    probeJwks('https://www.sanovacapital.com/api/auth/privy-jwks'),
    probeJwks('https://sanovacapital.com/api/auth/privy-jwks'),
    probeJwks(PRIVY_CUSTOM_AUTH_JWKS_URL_VERCEL)
  ]);

  const recommendation = wwwJwks.cloudflareChallenge || apexJwks.cloudflareChallenge
    ? vercelJwks.ok
      ? 'Set Privy Dashboard JWKS URL to the Vercel URL below, or paste the PEM public key (recommended). Do not use www.sanovacapital.com — Cloudflare blocks Privy.'
      : 'Custom domain JWKS is Cloudflare-blocked. Paste the PEM public key into Privy Dashboard JWT-based auth.'
    : wwwJwks.ok
      ? 'Custom domain JWKS looks reachable.'
      : 'Check Privy Dashboard JWKS / PEM configuration.';

  return NextResponse.json({
    customAuthEnabled: customAuthFlag,
    jwt: {
      kid: PRIVY_CUSTOM_AUTH_JWT_KID,
      issuer,
      issuerDefault: PRIVY_CUSTOM_AUTH_JWT_ISSUER_DEFAULT,
      audience,
      privateKeyConfigured: Boolean(privateKeyPem),
      privateKeyMatchesJwks,
      privateKeyError
    },
    jwksProbes: {
      www: wwwJwks,
      apex: apexJwks,
      vercel: vercelJwks
    },
    recommendedJwksUrl: PRIVY_CUSTOM_AUTH_JWKS_URL_VERCEL,
    recommendedPublicKeyPem: PRIVY_CUSTOM_AUTH_PUBLIC_KEY_PEM,
    recommendation,
    dashboardChecklist: [
      'User management → Authentication → JWT-based auth',
      'Verification: paste PEM public key OR JWKS = https://sano-token-web.vercel.app/api/auth/privy-jwks',
      'User ID claim = sub',
      'Auth from: Client-side or Both',
      'Allowed origins include https://www.sanovacapital.com',
      'If issuer is configured in Dashboard, it must equal jwt.issuer above'
    ]
  });
}
