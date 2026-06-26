import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import {
  decryptTotpSecret,
  generateBackupCodes,
  hashBackupCodes,
  verifyTotpCode
} from '../../../../../lib/auth/totpService';
import { prisma } from '@sanova/database';

/**
 * POST /api/auth/totp/confirm
 * Verifica que el usuario escaneó el QR correctamente ingresando un código válido.
 * Si es correcto, activa TOTP y genera los backup codes.
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

  if (!user?.totpSecret) {
    return NextResponse.json({ error: 'SETUP_NO_INICIADO' }, { status: 400 });
  }

  if (user.totpEnabled) {
    return NextResponse.json({ error: 'YA_ACTIVADO' }, { status: 400 });
  }

  const secret = decryptTotpSecret(user.totpSecret);
  const valid = verifyTotpCode(secret, code);

  if (!valid) {
    return NextResponse.json({ error: 'CODIGO_INCORRECTO' }, { status: 400 });
  }

  // Generar y guardar backup codes
  const plainCodes = generateBackupCodes();
  const hashed = await hashBackupCodes(plainCodes);

  await prisma.$transaction([
    prisma.backupCode.deleteMany({ where: { userId: session.user.id } }),
    prisma.backupCode.createMany({
      data: hashed.map((codeHash) => ({ userId: session.user.id, codeHash }))
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: { totpEnabled: true, failed2faAttempts: 0, locked2faUntil: null }
    })
  ]);

  // Retornar backup codes en texto plano (única vez)
  return NextResponse.json({ ok: true, backupCodes: plainCodes });
}
