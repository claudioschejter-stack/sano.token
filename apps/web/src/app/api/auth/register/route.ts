import { NextResponse } from 'next/server';
import { registerInvestor } from '../../../../lib/auth/registerService';
import { verifyTurnstile } from '../../../../lib/security/verifyTurnstile';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      phone?: string;
      fullName?: string;
      taxId?: string;
      termsAccepted?: boolean;
      inviteCode?: string;
      turnstileToken?: string;
    };

    const turnstileOk = await verifyTurnstile(body.turnstileToken);
    if (!turnstileOk) {
      return NextResponse.json({ error: 'CAPTCHA_INVALIDO' }, { status: 400 });
    }

    const result = await registerInvestor({
      email: body.email ?? '',
      password: body.password ?? '',
      phone: body.phone ?? '',
      fullName: body.fullName ?? '',
      taxId: body.taxId ?? '',
      termsAccepted: body.termsAccepted === true,
      inviteCode: body.inviteCode ?? ''
    });

    return NextResponse.json({
      ok: true,
      email: result.email,
      phone: result.phone
    });
  } catch (error) {
    console.error('[auth/register]', error);
    const code = error instanceof Error ? error.message : 'UNKNOWN';

    const status =
      code === 'EMAIL_IN_USE'
        ? 409
        : code === 'WEAK_PASSWORD' ||
            code === 'INVALID_PHONE' ||
            code === 'INVALID_EMAIL' ||
            code === 'INVALID_INPUT' ||
            code === 'TERMS_NOT_ACCEPTED' ||
            code === 'INVALID_INVITE_CODE' ||
            code === 'STAFF_INVITE_REQUIRED'
          ? 400
          : code === 'RATE_LIMIT'
            ? 429
            : 500;

    return NextResponse.json({ error: code }, { status });
  }
}
