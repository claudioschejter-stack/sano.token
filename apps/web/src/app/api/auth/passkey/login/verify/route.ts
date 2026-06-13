import { NextResponse } from 'next/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { resolvePasskeyWebContext } from '../../../../../../lib/auth/passkeyConfig';
import { verifyPasskeyLogin } from '../../../../../../lib/auth/passkeyService';

const KNOWN_PASSKEY_ERRORS = new Set([
  'CHALLENGE_EXPIRED',
  'PASSKEY_NOT_FOUND',
  'PASSKEY_LOGIN_FAILED',
  'PASSKEY_ORIGIN_NOT_ALLOWED',
  'PASSKEY_ORIGIN_MISSING',
  'AUTH_SECRET_NOT_CONFIGURED'
]);

export async function POST(request: Request) {
  const body = (await request.json()) as { response?: AuthenticationResponseJSON };

  if (!body.response) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  try {
    const webContext = resolvePasskeyWebContext(request);
    const result = await verifyPasskeyLogin(body.response, webContext);
    return NextResponse.json({ loginToken: result.loginToken, email: result.email });
  } catch (error) {
    console.error('[passkey/login/verify]', error);
    const code = error instanceof Error ? error.message : 'PASSKEY_LOGIN_FAILED';
    const errorCode = KNOWN_PASSKEY_ERRORS.has(code) ? code : 'PASSKEY_LOGIN_FAILED';
    return NextResponse.json({ error: errorCode }, { status: 401 });
  }
}
