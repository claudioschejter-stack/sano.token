import { NextResponse } from 'next/server';
import { normalizeEmail } from '../../../../../lib/auth/contactValidation';
import { evaluateRegisterEmailPrecheck } from '../../../../../lib/auth/registerEmailPrecheck';
import { recordRegistrationAttempt } from '../../../../../lib/auth/registrationAttemptService';
import { isCountryBlockedForRegistration } from '../../../../../lib/security/blockedCountries';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/register/check-email
 * Pre-check during registration to guide users with existing accounts before they submit the full form.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; channel?: string };
  const email = normalizeEmail(body.email ?? '');
  const ipCountry = request.headers.get('x-vercel-ip-country')?.trim() || null;

  if (isCountryBlockedForRegistration(ipCountry)) {
    return NextResponse.json({ error: 'REGION_NOT_AVAILABLE' }, { status: 403 });
  }

  if (!email) {
    return NextResponse.json({ error: 'INVALID_EMAIL' }, { status: 400 });
  }

  const channel =
    body.channel === 'pwa' || body.channel === 'mobile-web' || body.channel === 'desktop-web'
      ? body.channel
      : 'unknown';

  const result = await evaluateRegisterEmailPrecheck(email);

  if (result.available === false) {
    const errorCode =
      result.reason === 'EMAIL_IN_USE'
        ? 'EMAIL_IN_USE_PRECHECK'
        : result.reason === 'OAUTH_ONLY_DISABLED'
          ? 'OAUTH_ONLY_DISABLED_PRECHECK'
          : 'INVESTOR_ACCESS_NOT_ENABLED_PRECHECK';

    await recordRegistrationAttempt({
      email,
      success: false,
      errorCode,
      channel,
      ipCountry
    });

    return NextResponse.json({ available: false, reason: result.reason });
  }

  return NextResponse.json({ available: true });
}
