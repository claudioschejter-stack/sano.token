import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { decryptTotpSecret, verifyTotpCode } from '../../../../../lib/auth/totpService';
import { prisma } from '@sanova/database';
import { requiresInvestorStyleOnboarding } from '../../../../../lib/onboarding/onboardingGate';

/**
 * POST /api/auth/totp/disable
 * Desactiva el 2FA TOTP del usuario tras verificar el código actual.
 * Body: { code: string }
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'NO_AUTENTICADO' }, { status: 401 });
  }

  const body = (await request.json()) as { code?: string };
  const code = body.code?.trim();

  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'CODIGO_INVALIDO' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecret: true, totpEnabled: true, kycStatus: true, systemRole: true }
  });

  if (!user?.totpEnabled || !user.totpSecret) {
    return NextResponse.json({ error: 'TOTP_NO_ACTIVO' }, { status: 400 });
  }

  if (requiresInvestorStyleOnboarding(user.systemRole) && user.kycStatus === 'APPROVED') {
    return NextResponse.json({ error: 'TOTP_OBLIGATORIO' }, { status: 403 });
  }

  const secret = decryptTotpSecret(user.totpSecret);
  const valid = verifyTotpCode(secret, code);

  if (!valid) {
    return NextResponse.json({ error: 'CODIGO_INCORRECTO' }, { status: 400 });
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
