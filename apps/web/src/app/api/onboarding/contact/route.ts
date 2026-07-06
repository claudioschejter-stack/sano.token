import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { normalizePhoneE164, issueVerificationCode } from '../../../../lib/onboarding/verification';
import { requireAuthenticatedSession } from '../../../../lib/onboarding/requireAuthenticatedSession';
import { requiresPhoneVerification } from '../../../../lib/onboarding/phoneVerificationPolicy';
import { maybeReprocessPendingKyc } from '../../../../lib/onboarding/kycIngestionService';

export async function POST(request: Request) {
  const ctx = await requireAuthenticatedSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = (await request.json()) as { phone?: string };
  const phone = typeof body.phone === 'string' ? normalizePhoneE164(body.phone) : null;

  if (!phone) {
    return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400 });
  }

  const needsPhoneOtp = requiresPhoneVerification(ctx.role);

  const countryHint = request.headers
    .get('cookie')
    ?.match(/(?:^|; )sanova\.country=([^;]*)/)?.[1]
    ?.trim()
    .toUpperCase();

  const user = await prisma.user.update({
    where: { id: ctx.userId },
    data: {
      phone,
      ...(needsPhoneOtp ? { phoneVerifiedAt: null } : {}),
      ...(countryHint ? { jurisdiction: countryHint } : {})
    },
    select: { email: true, phone: true }
  });

  if (!needsPhoneOtp) {
    await maybeReprocessPendingKyc(ctx.userId);

    return NextResponse.json({
      ok: true,
      email: user.email,
      phone: user.phone
    });
  }

  try {
    const phoneDelivery = await issueVerificationCode(ctx.userId, 'PHONE', phone);
    if (!phoneDelivery.delivered) {
      return NextResponse.json(
        { error: phoneDelivery.deliveryError ?? 'WHATSAPP_DELIVERY_FAILED' },
        { status: 502 }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (message === 'RATE_LIMIT') {
      return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 });
    }

    console.warn('[onboarding/contact] phone code delivery failed', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    email: user.email,
    phone: user.phone
  });
}
