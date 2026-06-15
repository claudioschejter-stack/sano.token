import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { issueVerificationCode } from '../../../../lib/onboarding/verification';
import { requireAuthenticatedSession } from '../../../../lib/onboarding/requireAuthenticatedSession';
import { requiresPhoneVerification } from '../../../../lib/onboarding/phoneVerificationPolicy';

export async function POST() {
  const ctx = await requireAuthenticatedSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (!requiresPhoneVerification(ctx.role)) {
    return NextResponse.json({ error: 'PHONE_VERIFICATION_NOT_REQUIRED' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: {
      phone: true,
      phoneVerifiedAt: true
    }
  });

  if (!user?.phone?.trim()) {
    return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400 });
  }

  if (user.phoneVerifiedAt) {
    return NextResponse.json({ error: 'ALREADY_VERIFIED' }, { status: 400 });
  }

  try {
    const result = await issueVerificationCode(ctx.userId, 'PHONE', user.phone);

    if (!result.delivered) {
      return NextResponse.json(
        { error: result.deliveryError ?? 'WHATSAPP_DELIVERY_FAILED' },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, channel: 'PHONE' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (message === 'RATE_LIMIT') {
      return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
