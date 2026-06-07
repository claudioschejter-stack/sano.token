import { NextResponse } from 'next/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { verifyPasskeyLogin } from '../../../../../../lib/auth/passkeyService';

export async function POST(request: Request) {
  const body = (await request.json()) as { response?: AuthenticationResponseJSON };

  if (!body.response) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  try {
    const result = await verifyPasskeyLogin(body.response);
    return NextResponse.json({ loginToken: result.loginToken });
  } catch (error) {
    console.error('[passkey/login/verify]', error);
    return NextResponse.json({ error: 'PASSKEY_LOGIN_FAILED' }, { status: 401 });
  }
}
