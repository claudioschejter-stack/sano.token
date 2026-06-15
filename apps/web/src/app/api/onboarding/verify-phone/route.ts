import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { consumeVerificationCode } from '../../../../lib/onboarding/verification';
import { requireAuthenticatedSession } from '../../../../lib/onboarding/requireAuthenticatedSession';
import { syncUserAccountStatus } from '../../../../lib/onboarding/syncUserAccount';
import { requiresPhoneVerification } from '../../../../lib/onboarding/phoneVerificationPolicy';

export async function POST(request: Request) {
  const ctx = await requireAuthenticatedSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (!requiresPhoneVerification(ctx.role)) {
    return NextResponse.json({ error: 'PHONE_VERIFICATION_NOT_REQUIRED' }, { status: 400 });
  }

  const body = (await request.json()) as { code?: string };
  const code = typeof body.code === 'string' ? body.code : '';

  if (!code) {
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { phone: true }
  });

  if (!user?.phone?.trim()) {
    return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400 });
  }

  const valid = await consumeVerificationCode(ctx.userId, 'PHONE', code);

  if (!valid) {
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: ctx.userId },
    data: { phoneVerifiedAt: new Date() }
  });

  await syncUserAccountStatus(ctx.userId);

  return NextResponse.json({ ok: true });
}
