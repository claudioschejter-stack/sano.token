import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { prisma } from '@sanova/database';
import {
  is2faLocked,
  lockoutRemainingSeconds,
  lockUntilDate,
  MAX_2FA_ATTEMPTS,
  shouldLock,
  verifyTempTotpToken
} from '../../../../../lib/auth/totpService';
import { consumeLoginEmailCode } from '../../../../../lib/auth/loginEmailCodeService';
import { issueAuthUser, updateUserRoleIfNeeded } from '../../../../../lib/auth/issueAuthUser';
import type { SystemRole } from '../../../../../lib/auth/roles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
 * POST /api/auth/email-code/login-verify — second step of the desktop login.
 * Body: `{ tempToken, code }`
 *
 * Returns a `loginToken` the client redeems with `signIn('passkey', …)`, the
 * same mechanism the passkey and post-TOTP logins already use.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    tempToken?: string;
    code?: string;
  };

  const tempToken = body.tempToken?.trim();
  const code = body.code?.trim() ?? '';

  if (!tempToken) {
    return NextResponse.json({ error: 'TOKEN_REQUERIDO' }, { status: 400 });
  }

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
      failed2faAttempts: true,
      locked2faUntil: true
    }
  });

  if (!user?.email) {
    return NextResponse.json({ error: 'USUARIO_INVALIDO' }, { status: 400 });
  }

  if (is2faLocked(user)) {
    return NextResponse.json(
      { error: 'CUENTA_BLOQUEADA', remainingSeconds: lockoutRemainingSeconds(user) },
      { status: 429 }
    );
  }

  const verified = await consumeLoginEmailCode({ userId: user.id, code });

  if (!verified) {
    const attempts = user.failed2faAttempts + 1;
    const lock = shouldLock(attempts);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failed2faAttempts: attempts,
        locked2faUntil: lock ? lockUntilDate() : undefined
      }
    });

    return NextResponse.json(
      {
        error: lock ? 'CUENTA_BLOQUEADA' : 'CODIGO_INCORRECTO',
        remainingAttempts: Math.max(0, MAX_2FA_ATTEMPTS - attempts),
        remainingSeconds: lock
          ? Math.ceil((lockUntilDate().getTime() - Date.now()) / 1000)
          : undefined
      },
      { status: 401 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failed2faAttempts: 0, locked2faUntil: null }
  });

  const role = await updateUserRoleIfNeeded(user.id, user.email, user.systemRole as SystemRole);
  const authUser = await issueAuthUser(user.id, user.email, role);

  const loginToken = await new SignJWT({ sub: authUser.id, purpose: 'passkey-login' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(LOGIN_TOKEN_TTL)
    .sign(loginSecret());

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
