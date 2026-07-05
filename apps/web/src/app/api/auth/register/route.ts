import { NextResponse } from 'next/server';
import { registerInvestor } from '../../../../lib/auth/registerService';
import { recordRegistrationAttempt } from '../../../../lib/auth/registrationAttemptService';
import { normalizeEmail } from '../../../../lib/auth/contactValidation';
import { requireTurnstile } from '../../../../lib/security/requireTurnstile';

function resolveChannel(raw: unknown): 'desktop' | 'pwa' | 'unknown' {
  if (raw === 'pwa' || raw === 'desktop') {
    return raw;
  }
  return 'unknown';
}

export async function POST(request: Request) {
  let emailForLog = '';
  let channel: 'desktop' | 'pwa' | 'unknown' = 'unknown';
  const ipCountry = request.headers.get('x-vercel-ip-country')?.trim() || null;

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
      channel?: string;
    };

    channel = resolveChannel(body.channel);
    emailForLog = normalizeEmail(body.email ?? '') ?? body.email?.trim().toLowerCase() ?? '';

    const captchaError = await requireTurnstile(body.turnstileToken);
    if (captchaError) {
      await recordRegistrationAttempt({
        email: emailForLog,
        success: false,
        errorCode: 'CAPTCHA_INVALIDO',
        channel,
        ipCountry
      });
      return captchaError;
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

    await recordRegistrationAttempt({
      email: result.email,
      success: true,
      channel,
      ipCountry
    });

    return NextResponse.json({
      ok: true,
      email: result.email,
      phone: result.phone
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';

    console.error('[auth/register]', {
      email: emailForLog,
      errorCode: code,
      channel,
      ipCountry
    });

    if (emailForLog) {
      await recordRegistrationAttempt({
        email: emailForLog,
        success: false,
        errorCode: code,
        channel,
        ipCountry
      });
    }

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
