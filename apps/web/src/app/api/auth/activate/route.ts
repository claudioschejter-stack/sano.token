import { NextResponse } from 'next/server';
import { activateAccountWithToken } from '../../../../lib/onboarding/accountActivationService';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string };
    const token = body.token?.trim();

    if (!token) {
      return NextResponse.json({ error: 'INVALID_OR_EXPIRED_TOKEN' }, { status: 400 });
    }

    const result = await activateAccountWithToken(token);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GENERIC';
    if (message === 'INVALID_OR_EXPIRED_TOKEN') {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('[auth/activate]', error);
    return NextResponse.json({ error: 'GENERIC' }, { status: 500 });
  }
}
