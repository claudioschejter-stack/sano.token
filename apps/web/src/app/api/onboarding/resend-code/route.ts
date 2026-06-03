import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { issueVerificationCode } from '../../../../lib/onboarding/verification';
import { requireAuthenticatedSession } from '../../../../lib/onboarding/requireAuthenticatedSession';

export async function POST() {
  const ctx = await requireAuthenticatedSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: {
      email: true,
      emailVerifiedAt: true
    }
  });

  if (!user) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  if (user.emailVerifiedAt) {
    return NextResponse.json({ error: 'ALREADY_VERIFIED' }, { status: 400 });
  }

  try {
    const result = await issueVerificationCode(ctx.userId, 'EMAIL', user.email);

    if (!result.delivered) {
      return NextResponse.json(
        { error: result.deliveryError ?? 'EMAIL_DELIVERY_FAILED' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      channel: 'EMAIL',
      devCode: result.devCode
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (message === 'RATE_LIMIT') {
      return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
