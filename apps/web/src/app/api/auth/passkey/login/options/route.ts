import { NextResponse } from 'next/server';
import { createPasskeyLoginOptions } from '../../../../../../lib/auth/passkeyService';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string | null };

  try {
    const options = await createPasskeyLoginOptions(body.email);
    return NextResponse.json({ options });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PASSKEY_OPTIONS_FAILED';
    const status = message === 'PASSKEY_NOT_FOUND' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
