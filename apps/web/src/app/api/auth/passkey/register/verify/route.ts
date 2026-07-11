import { NextResponse } from 'next/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { auth } from '../../../../../../auth';
import { resolvePasskeyWebContext } from '../../../../../../lib/auth/passkeyConfig';
import { verifyPasskeyRegistration } from '../../../../../../lib/auth/passkeyService';

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = (await request.json()) as {
    response?: RegistrationResponseJSON;
    deviceName?: string | null;
  };

  if (!body.response) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  try {
    const webContext = resolvePasskeyWebContext(request);
    await verifyPasskeyRegistration(userId, body.response, body.deviceName, webContext);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[passkey/register/verify]', error);
    const code = error instanceof Error ? error.message : 'PASSKEY_REGISTER_FAILED';
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
