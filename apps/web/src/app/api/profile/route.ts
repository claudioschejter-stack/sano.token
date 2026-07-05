import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { requireAuthenticatedSession } from '../../../lib/onboarding/requireAuthenticatedSession';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireAuthenticatedSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { name: true, image: true }
  });

  return NextResponse.json({ name: user?.name ?? null, image: user?.image ?? null });
}
