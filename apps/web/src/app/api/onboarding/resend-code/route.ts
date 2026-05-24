import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { issueVerificationCode } from '../../../../lib/onboarding/verification';
import { requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';

type ResendBody = {
  channel?: 'EMAIL' | 'PHONE';
};

export async function POST(request: Request) {
  const ctx = await requireInvestorSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('forbidden' in ctx) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as ResendBody;
  const channel = body.channel === 'PHONE' ? 'PHONE' : 'EMAIL';

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: {
      email: true,
      phone: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true
    }
  });

  if (!user) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  if (channel === 'EMAIL') {
    if (user.emailVerifiedAt) {
      return NextResponse.json({ error: 'ALREADY_VERIFIED' }, { status: 400 });
    }
  } else if (user.phoneVerifiedAt) {
    return NextResponse.json({ error: 'ALREADY_VERIFIED' }, { status: 400 });
  } else if (!user.phone) {
    return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400 });
  }

  const target = channel === 'EMAIL' ? user.email : user.phone!;

  try {
    const result = await issueVerificationCode(ctx.userId, channel, target);

    if (!result.delivered) {
      return NextResponse.json(
        {
          error:
            channel === 'EMAIL'
              ? result.deliveryError ?? 'EMAIL_DELIVERY_FAILED'
              : result.deliveryError ?? 'SMS_DELIVERY_FAILED'
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      channel,
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
