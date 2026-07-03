import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { prisma } from '@sanova/database';

/**
 * POST /api/auth/totp/reset-setup
 * Clears a pending (not yet enabled) TOTP configuration so onboarding can start clean.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'NO_AUTENTICADO' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpEnabled: true }
  });

  if (user?.totpEnabled) {
    return NextResponse.json({ error: 'YA_ACTIVADO' }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.backupCode.deleteMany({ where: { userId: session.user.id } }),
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        totpSecret: null,
        totpEnabled: false,
        failed2faAttempts: 0,
        locked2faUntil: null
      }
    })
  ]);

  return NextResponse.json({ ok: true });
}
