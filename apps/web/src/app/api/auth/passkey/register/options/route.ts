import { NextResponse } from 'next/server';
import { auth } from '../../../../../../auth';
import { createPasskeyRegistrationOptions } from '../../../../../../lib/auth/passkeyService';
import { resolvePasskeyWebContext } from '../../../../../../lib/auth/passkeyConfig';

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const options = await createPasskeyRegistrationOptions(userId, resolvePasskeyWebContext(request));
    return NextResponse.json({ options });
  } catch (error) {
    console.error('[passkey/register/options]', error);
    return NextResponse.json({ error: 'PASSKEY_OPTIONS_FAILED' }, { status: 500 });
  }
}
