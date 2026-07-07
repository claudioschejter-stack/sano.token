import { NextResponse } from 'next/server';
import { resendAccountActivationEmail } from '../../../../lib/onboarding/accountActivationService';
import { normalizeEmail } from '../../../../lib/auth/contactValidation';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = normalizeEmail(body.email ?? '');

    if (!email) {
      return NextResponse.json({ error: 'INVALID_EMAIL' }, { status: 400 });
    }

    const result = await resendAccountActivationEmail(email);
    return NextResponse.json({
      ok: true,
      devActivationUrl: result.devActivationUrl
    });
  } catch (error) {
    console.error('[auth/resend-activation]', error);
    return NextResponse.json({ error: 'GENERIC' }, { status: 500 });
  }
}
