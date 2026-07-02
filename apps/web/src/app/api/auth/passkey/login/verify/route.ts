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

function parsePasskeyError(error: unknown): { code: string; remainingSeconds?: number } {
  if (error instanceof Error && error.message.startsWith('CUENTA_BLOQUEADA:')) {
    const remainingSeconds = Number.parseInt(error.message.split(':')[1] ?? '0', 10);
    return { code: 'CUENTA_BLOQUEADA', remainingSeconds: Number.isFinite(remainingSeconds) ? remainingSeconds : 0 };
  }
  const code = error instanceof Error ? error.message : 'PASSKEY_LOGIN_FAILED';
  return { code: KNOWN_PASSKEY_ERRORS.has(code) ? code : 'PASSKEY_LOGIN_FAILED' };
}

export async function POST(request: Request) {
  const body = (await request.json()) as { response?: AuthenticationResponseJSON };

  if (!body.response) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  try {
    const webContext = resolvePasskeyWebContext(request);
    const result = await verifyPasskeyLogin(body.response, webContext);
    if (result.requiresTOTP) {
      return NextResponse.json({
        requiresTOTP: true,
        tempToken: result.tempToken,
        email: result.email
      });
    }
    return NextResponse.json({ loginToken: result.loginToken, email: result.email });
  } catch (error) {
    console.error('[passkey/login/verify]', error);
    const parsed = parsePasskeyError(error);
    if (parsed.code === 'CUENTA_BLOQUEADA') {
      return NextResponse.json(
        { error: parsed.code, remainingSeconds: parsed.remainingSeconds },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: parsed.code }, { status: 401 });
  }
}
