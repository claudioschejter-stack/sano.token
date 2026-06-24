/**
 * Issues a short-lived RS256 JWT for the authenticated NextAuth user.
 *
 * Privy verifies this JWT against our JWKS (/api/auth/privy-jwks) and silently
 * authenticates the user without showing its own login modal.
 *
 * Called by usePrivySessionSync on every page load when the user is authenticated.
 * Only accessible by the same browser session (credentials: 'same-origin').
 *
 * Requires PRIVY_JWT_PRIVATE_KEY to be set in Vercel env vars.
 */

import { NextResponse } from 'next/server';
import { SignJWT, importPKCS8 } from 'jose';
import { auth } from '../../../../auth';

const KID = 'sanova-rwa-v1';
const ISSUER = 'https://sanovacapital.com';
const PRIVY_APP_ID = 'cmqiztako002p0bjmjiqaebuw';
/** Token lifespan — 10 minutes is enough; hook refreshes before expiry. */
const TOKEN_TTL_SECONDS = 600;

function resolvePrivateKey(): string | null {
  const raw = process.env.PRIVY_JWT_PRIVATE_KEY?.trim();
  if (!raw) return null;
  // Env var stores \n as literal backslash-n; restore real newlines.
  return raw.replace(/\\n/g, '\n');
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const rawPrivateKey = resolvePrivateKey();
  if (!rawPrivateKey) {
    return NextResponse.json({ error: 'PRIVY_JWT_NOT_CONFIGURED' }, { status: 503 });
  }

  try {
    const privateKey = await importPKCS8(rawPrivateKey, 'RS256');

    const token = await new SignJWT({
      email: session.user.email ?? undefined
    })
      .setProtectedHeader({ alg: 'RS256', kid: KID })
      .setSubject(session.user.id)
      .setIssuer(ISSUER)
      .setAudience(PRIVY_APP_ID)
      .setIssuedAt()
      .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
      .sign(privateKey);

    return NextResponse.json(
      { token },
      {
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  } catch (err) {
    console.error('[privy-token] JWT signing failed:', err);
    return NextResponse.json({ error: 'JWT_SIGN_FAILED' }, { status: 500 });
  }
}
