import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';

/**
 * POST /api/auth/login/check-email
 * Paso 1 del login desktop: valida que el email exista y la cuenta no esté suspendida.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string };
  const email = body.email?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: 'EMAIL_REQUERIDO' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, accountStatus: true, passwordHash: true }
  });

  if (!user?.passwordHash) {
    return NextResponse.json({ error: 'CREDENCIALES_INVALIDAS' }, { status: 401 });
  }

  if (user.accountStatus === 'SUSPENDED') {
    return NextResponse.json({ error: 'CUENTA_SUSPENDIDA' }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
