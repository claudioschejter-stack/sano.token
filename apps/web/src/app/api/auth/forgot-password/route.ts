import { NextResponse } from 'next/server';
import { requestPasswordReset } from '../../../../lib/auth/passwordResetService';
import { verifyTurnstile } from '../../../../lib/security/verifyTurnstile';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; turnstileToken?: string };

    const turnstileOk = await verifyTurnstile(body.turnstileToken);
    if (!turnstileOk) {
      return NextResponse.json({ error: 'CAPTCHA_INVALIDO' }, { status: 400 });
    }

    const result = await requestPasswordReset(body.email ?? '');

    return NextResponse.json(result);
  } catch (error) {
    console.error('[auth/forgot-password]', error);
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (message === 'AUTH_SECRET_NOT_CONFIGURED') {
      return NextResponse.json({ error: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }

    return NextResponse.json({ error: 'REQUEST_FAILED' }, { status: 500 });
  }
}
