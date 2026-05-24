import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { issueVerificationCode, normalizePhoneE164 } from '../../../../lib/onboarding/verification';
import { requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';

export async function POST(request: Request) {
  const ctx = await requireInvestorSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('forbidden' in ctx) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const body = (await request.json()) as { phone?: string };
  const phone = typeof body.phone === 'string' ? normalizePhoneE164(body.phone) : null;

  if (!phone) {
    return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: ctx.userId },
    data: { phone },
    select: { email: true, phone: true }
  });

  try {
    const emailResult = await issueVerificationCode(ctx.userId, 'EMAIL', user.email);

    if (!emailResult.delivered) {
      return NextResponse.json(
        { error: emailResult.deliveryError ?? 'EMAIL_DELIVERY_FAILED' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      email: user.email,
      phone: user.phone,
      devCodes: emailResult.devCode ? { email: emailResult.devCode } : undefined
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (message === 'RATE_LIMIT') {
      return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
