import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { requireAuthenticatedSession } from '../../../../lib/onboarding/requireAuthenticatedSession';

export async function POST() {
  try {
    const ctx = await requireAuthenticatedSession();
    if (!ctx) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: ctx.userId },
      data: { onboardingSuccessShownAt: new Date() }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[onboarding/ack-success]', error);
    return NextResponse.json({ error: 'GENERIC' }, { status: 500 });
  }
}
