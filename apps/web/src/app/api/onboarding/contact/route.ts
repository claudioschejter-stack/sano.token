import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { normalizePhoneE164 } from '../../../../lib/onboarding/verification';
import { requireAuthenticatedSession } from '../../../../lib/onboarding/requireAuthenticatedSession';

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

  const user = await prisma.user.update({
    where: { id: ctx.userId },
    data: { phone },
    select: { email: true, phone: true }
  });

  return NextResponse.json({
    ok: true,
    email: user.email,
    phone: user.phone
  });
}
