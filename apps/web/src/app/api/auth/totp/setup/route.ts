import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { encryptTotpSecret, generateTotpSecret, getTotpUri } from '../../../../../lib/auth/totpService';
import { prisma } from '@sanova/database';

/**
 * POST /api/auth/totp/setup
 * Genera un nuevo secret TOTP y lo almacena (pendiente de confirmación).
 * Retorna el URI para generar el QR (no retorna el secret en texto plano).
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'NO_AUTENTICADO' }, { status: 401 });
  }

  const secret = generateTotpSecret();
  const encrypted = encryptTotpSecret(secret);
  const uri = getTotpUri(secret, session.user.email ?? session.user.id);

  // Guardar secret encriptado (aún no habilitado — totpEnabled sigue en false)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: encrypted }
  });

  return NextResponse.json({ uri, secret });
}
