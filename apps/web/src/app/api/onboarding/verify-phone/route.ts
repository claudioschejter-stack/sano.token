import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { consumeVerificationCode } from '../../../../lib/onboarding/verification';
import { requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';
import { syncUserAccountStatus } from '../../../../lib/onboarding/syncUserAccount';

export async function POST(request: Request) {
  const ctx = await requireInvestorSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('forbidden' in ctx) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const body = (await request.json()) as { code?: string };
  const code = typeof body.code === 'string' ? body.code : '';

  if (!code) {
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 });
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
