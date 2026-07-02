import { NextResponse } from 'next/server';
import { verifyCredentials } from '../../../../../lib/auth/credentialsService';
import { is2faLocked, issueTempTotpToken, lockoutRemainingSeconds } from '../../../../../lib/auth/totpService';
import { requireTurnstile } from '../../../../../lib/security/requireTurnstile';
import { prisma } from '@sanova/database';

/**
 * POST /api/auth/login/step1
 * Verifica email + contraseña.
 *
 * Respuestas posibles:
 *  - { ok: true, requiresTOTP: false } → login completo vía NextAuth (se espera que el cliente
 *    llame a signIn('credentials') normalmente)
 *  - { ok: true, requiresTOTP: true, tempToken: string } → el usuario debe completar TOTP
 *  - { error: ... } → credenciales inválidas
 */
export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string; turnstileToken?: string };
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  const captchaError = await requireTurnstile(body.turnstileToken);
  if (captchaError) return captchaError;

  if (!email || !password) {
    return NextResponse.json({ error: 'CREDENCIALES_INCOMPLETAS' }, { status: 400 });
  }

  const authUser = await verifyCredentials(email, password);
  if (!authUser) {
    return NextResponse.json({ error: 'CREDENCIALES_INVALIDAS' }, { status: 401 });
  }

  // Verificar si tiene TOTP activo
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { totpEnabled: true, locked2faUntil: true, kycStatus: true, walletAddress: true, systemRole: true }
  });

  if (!user) {
    return NextResponse.json({ error: 'CREDENCIALES_INVALIDAS' }, { status: 401 });
  }

  if (!user.totpEnabled) {
    return NextResponse.json({ ok: true, requiresTOTP: false });
  }

  // Verificar bloqueo
  if (is2faLocked(user)) {
    return NextResponse.json(
      { error: 'CUENTA_BLOQUEADA', remainingSeconds: lockoutRemainingSeconds(user) },
      { status: 429 }
    );
  }

  // Emitir token temporal para el paso 2
  const tempToken = await issueTempTotpToken(authUser.id);
  return NextResponse.json({ ok: true, requiresTOTP: true, tempToken });
}
