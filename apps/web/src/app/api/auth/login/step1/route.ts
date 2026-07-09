import { NextResponse } from 'next/server';
import { verifyCredentials } from '../../../../../lib/auth/credentialsService';
import { bypassesTotpGateForRole } from '../../../../../lib/auth/adminAuthPolicy';
import { is2faLocked, issueTempTotpToken, lockoutRemainingSeconds } from '../../../../../lib/auth/totpService';
import { issueMobilePasswordLoginToken } from '../../../../../lib/auth/passkeyService';
import { prisma } from '@sanova/database';

type LoginChannel = 'pwa' | 'mobile-web' | 'desktop-web';

function isMobileChannel(channel?: string | null): boolean {
  return channel === 'pwa' || channel === 'mobile-web';
}

/**
 * POST /api/auth/login/step1
 * Verifica email + contraseña.
 *
 * Respuestas posibles:
 *  - { ok: true, requiresTOTP: false } → login completo vía NextAuth (se espera que el cliente
 *    llame a signIn('credentials') normalmente)
 *  - { ok: true, requiresTOTP: true, tempToken: string } → el usuario debe completar TOTP
 *    (solo desktop; en móvil nunca se devuelve esto, ver más abajo)
 *  - { ok: true, requiresTOTP: false, loginToken: string } → canal móvil/PWA con TOTP
 *    activado: en vez de pedir el código, se emite un login token de un solo uso
 *    (el mismo mecanismo que usa el login por passkey) para que el cliente entre
 *    con `signIn('passkey', { loginToken })` sin pasar nunca por TOTP en el celular.
 *  - { error: ... } → credenciales inválidas
 */
export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string; channel?: LoginChannel };
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

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

  // NOTE: this must stay consistent with the `credentials` provider's authorize()
  // gate in auth.ts, which unconditionally blocks sign-in when totpEnabled is true
  // (except for roles that bypass the gate). Skipping TOTP here without also
  // skipping the `credentials` provider's gate previously caused mobile logins to
  // silently fail: this endpoint said requiresTOTP: false, the client called
  // signIn('credentials'), and NextAuth rejected it anyway.
  if (!user.totpEnabled || bypassesTotpGateForRole(authUser.role)) {
    return NextResponse.json({ ok: true, requiresTOTP: false });
  }

  if (is2faLocked(user)) {
    return NextResponse.json(
      { error: 'CUENTA_BLOQUEADA', remainingSeconds: lockoutRemainingSeconds(user) },
      { status: 429 }
    );
  }

  // Mobile/PWA is fingerprint-only: it never shows the TOTP screen, even for
  // users who enabled 2FA from desktop. Instead of the `credentials` provider
  // (which would block on totpEnabled), issue a one-time login token redeemed
  // via the same safe path as a real passkey login.
  if (isMobileChannel(body.channel)) {
    const loginToken = await issueMobilePasswordLoginToken(authUser.id, email);
    return NextResponse.json({ ok: true, requiresTOTP: false, loginToken });
  }

  const tempToken = await issueTempTotpToken(authUser.id);
  return NextResponse.json({ ok: true, requiresTOTP: true, tempToken });
}
