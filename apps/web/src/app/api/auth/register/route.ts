import { NextResponse } from 'next/server';
import { registerInvestor } from '../../../../lib/auth/registerService';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      phone?: string;
      fullName?: string;
      taxId?: string;
    };

    const result = await registerInvestor({
      email: body.email ?? '',
      password: body.password ?? '',
      phone: body.phone ?? '',
      fullName: body.fullName ?? '',
      taxId: body.taxId ?? ''
    });

    const exposeDev =
      process.env.ONBOARDING_DEV_EXPOSE_CODE === 'true' ||
      process.env.NODE_ENV !== 'production';

    return NextResponse.json({
      ok: true,
      email: result.email,
      delivery: result.delivery,
      devCodes: exposeDev ? result.devCodes : undefined,
      deliveryPending: false
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
            code === 'INVALID_INPUT'
          ? 400
          : code === 'RATE_LIMIT'
            ? 429
            : code === 'VERIFICATION_DELIVERY_FAILED'
              ? 502
              : 500;

    return NextResponse.json({ error: code }, { status });
  }
}
