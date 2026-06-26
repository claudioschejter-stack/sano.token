import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import {
  decryptTotpSecret,
  is2faLocked,
  lockoutRemainingSeconds,
  lockUntilDate,
  MAX_2FA_ATTEMPTS,
  shouldLock,
  verifyTotpCode,
  verifyTempTotpToken
} from '../../../../../lib/auth/totpService';
import { verifyBackupCode } from '../../../../../lib/auth/totpService';
import { prisma } from '@sanova/database';
import { issueAuthUser, updateUserRoleIfNeeded } from '../../../../../lib/auth/issueAuthUser';

const LOGIN_TOKEN_TTL = '2m';

function loginSecret(): Uint8Array {
  const secret =
    process.env.AUTH_INTERNAL_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error('AUTH_SECRET_NOT_CONFIGURED');
  return new TextEncoder().encode(secret);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * POST /api/auth/totp/login-verify
 * Segundo paso del login cuando TOTP está activo.
 * Body: { tempToken: string, code: string } | { tempToken: string, backupCode: string }
 *
 * Respuesta: { loginToken: string } → el cliente llama signIn('passkey', { loginToken })
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    tempToken?: string;
    code?: string;
    backupCode?: string;
  };

  const { tempToken, code, backupCode } = body;

  if (!tempToken) {
    return NextResponse.json({ error: 'TOKEN_REQUERIDO' }, { status: 400 });
  }

  // Verificar temp token
  const userId = await verifyTempTotpToken(tempToken);
  if (!userId) {
    return NextResponse.json({ error: 'TOKEN_EXPIRADO' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      systemRole: true,
      totpSecret: true,
      totpEnabled: true,
      failed2faAttempts: true,
      locked2faUntil: true,
      backupCodes: { select: { id: true, codeHash: true, usedAt: true } }
    }
  });

  if (!user?.totpEnabled || !user.totpSecret) {
    return NextResponse.json({ error: 'TOTP_NO_ACTIVO' }, { status: 400 });
  }

  if (is2faLocked(user)) {
    return NextResponse.json(
      { error: 'CUENTA_BLOQUEADA', remainingSeconds: lockoutRemainingSeconds(user) },
      { status: 429 }
    );
  }

  let verified = false;

  // Verificar código TOTP
  if (code && /^\d{6}$/.test(code.trim())) {
    const secret = decryptTotpSecret(user.totpSecret);
    verified = verifyTotpCode(secret, code.trim());
  }

  // Verificar backup code (si no pasó TOTP)
  if (!verified && backupCode) {
    const availableCodes = user.backupCodes.filter((bc) => !bc.usedAt);
    const hashes = availableCodes.map((bc) => bc.codeHash);
    const matchIndex = await verifyBackupCode(backupCode, hashes);

    if (matchIndex >= 0) {
      const matchedCode = availableCodes[matchIndex];
      await prisma.backupCode.update({
        where: { id: matchedCode.id },
        data: { usedAt: new Date() }
      });
      verified = true;
    }
  }

  if (!verified) {
    const newAttempts = user.failed2faAttempts + 1;
    const lock = shouldLock(newAttempts);

    await prisma.user.update({
      where: { id: userId },
      data: {
        failed2faAttempts: newAttempts,
        locked2faUntil: lock ? lockUntilDate() : undefined
      }
    });

    const remainingAttempts = Math.max(0, MAX_2FA_ATTEMPTS - newAttempts);

    return NextResponse.json(
      {
        error: lock ? 'CUENTA_BLOQUEADA' : 'CODIGO_INCORRECTO',
        remainingAttempts,
        remainingSeconds: lock ? Math.ceil((lockUntilDate().getTime() - Date.now()) / 1000) : undefined
      },
      { status: 401 }
    );
  }

  // Código correcto → resetear contador
  await prisma.user.update({
    where: { id: userId },
    data: { failed2faAttempts: 0, locked2faUntil: null }
  });

  // Emitir loginToken (mismo mecanismo que passkey login)
  const role = await updateUserRoleIfNeeded(user.id, user.email, user.systemRole as import('../../../../../lib/auth/roles').SystemRole);
  const authUser = issueAuthUser(user.id, user.email, role);

  const loginToken = await new SignJWT({ sub: authUser.id, purpose: 'passkey-login' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(LOGIN_TOKEN_TTL)
    .sign(loginSecret());

  // Registrar token en WebAuthnChallenge para que verifyPasskeyLoginToken lo encuentre
  await prisma.webAuthnChallenge.create({
    data: {
      challenge: hashToken(loginToken),
      type: 'LOGIN_TOKEN',
      userId: user.id,
      email: user.email,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000)
    }
  });

  return NextResponse.json({ loginToken });
}
