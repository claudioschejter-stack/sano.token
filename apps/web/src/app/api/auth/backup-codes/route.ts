import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import {
  decryptTotpSecret,
  generateBackupCodes,
  hashBackupCodes,
  verifyTotpCode
} from '../../../../lib/auth/totpService';
import { prisma } from '@sanova/database';

/**
 * POST /api/auth/backup-codes
 * Regenera los 8 backup codes. Requiere verificar el código TOTP actual.
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
    select: { totpSecret: true, totpEnabled: true }
  });

  if (!user?.totpEnabled || !user.totpSecret) {
    return NextResponse.json({ error: 'TOTP_NO_ACTIVO' }, { status: 400 });
  }

  const secret = decryptTotpSecret(user.totpSecret);
  if (!verifyTotpCode(secret, code)) {
    return NextResponse.json({ error: 'CODIGO_INCORRECTO' }, { status: 400 });
  }

  const plainCodes = generateBackupCodes();
  const hashed = await hashBackupCodes(plainCodes);

  await prisma.$transaction([
    prisma.backupCode.deleteMany({ where: { userId: session.user.id } }),
    prisma.backupCode.createMany({
      data: hashed.map((codeHash) => ({ userId: session.user.id, codeHash }))
    })
  ]);

  return NextResponse.json({ backupCodes: plainCodes });
}
