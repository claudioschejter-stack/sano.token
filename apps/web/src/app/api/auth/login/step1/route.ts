import { NextResponse } from 'next/server';
import { verifyCredentials } from '../../../../../lib/auth/credentialsService';
import { is2faLocked, issueTempTotpToken, lockoutRemainingSeconds } from '../../../../../lib/auth/totpService';
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
  const body = (await request.json()) as { email?: string; password?: string; channel?: string };
  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  const channel = body.channel?.trim();
  const isMobileChannel = channel === 'pwa' || channel === 'mobile-web';

  if (!email || !password) {
    return NextResponse.json({ error: 'CREDENCIALES_INCOMPLETAS' }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { oauthProvider: true, passwordHash: true }
  });

  if (existingUser?.oauthProvider && !existingUser.passwordHash) {
    return NextResponse.json({ error: 'OAUTH_ONLY_SIGN_IN_REQUIRED' }, { status: 401 });
  }

  let authUser;
  try {
    authUser = await verifyCredentials(email, password);
  } catch (error) {
    if (error instanceof Error && error.message === 'INVESTOR_ACCESS_NOT_ENABLED') {
      return NextResponse.json({ error: 'INVESTOR_ACCESS_NOT_ENABLED' }, { status: 403 });
    }

    throw error;
  }

  if (!authUser) {
    return NextResponse.json({ error: 'CREDENCIALES_INVALIDAS' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { totpEnabled: true, locked2faUntil: true, kycStatus: true, walletAddress: true, systemRole: true }
  });

  if (!user) {
    return NextResponse.json({ error: 'CREDENCIALES_INVALIDAS' }, { status: 401 });
  }

  if (!user.totpEnabled || isMobileChannel) {
    return NextResponse.json({ ok: true, requiresTOTP: false });
  }

  if (is2faLocked(user)) {
    return NextResponse.json(
      { error: 'CUENTA_BLOQUEADA', remainingSeconds: lockoutRemainingSeconds(user) },
      { status: 429 }
    );
  }

  const tempToken = await issueTempTotpToken(authUser.id);
  return NextResponse.json({ ok: true, requiresTOTP: true, tempToken });
}
