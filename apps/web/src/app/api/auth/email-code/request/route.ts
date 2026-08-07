import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { verifyTempTotpToken } from '../../../../../lib/auth/totpService';
import { issueLoginEmailCode } from '../../../../../lib/auth/loginEmailCodeService';
import { is2faLocked, lockoutRemainingSeconds } from '../../../../../lib/auth/totpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/auth/email-code/request  — send the login code.
 * Body: `{ tempToken }`
 *
 * The verification screen asks for this itself instead of the code being pushed
 * during step 1. That way the password login and the OAuth gate — which reaches
 * the same screen through the middleware with only a pending token — go through
 * one path, and a user who closes the tab can get a fresh code by reloading.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { tempToken?: string };
  const tempToken = body.tempToken?.trim();

  if (!tempToken) {
    return NextResponse.json({ error: 'TOKEN_REQUERIDO' }, { status: 400 });
  }

  const userId = await verifyTempTotpToken(tempToken);
  if (!userId) {
    return NextResponse.json({ error: 'TOKEN_EXPIRADO' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, failed2faAttempts: true, locked2faUntil: true }
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

  const issued = await issueLoginEmailCode({ userId: user.id, email: user.email });

  if (issued.ok === false) {
    return NextResponse.json(
      { error: 'DEMASIADOS_CODIGOS', remainingSeconds: issued.retryAfterSeconds },
      { status: 429 }
    );
  }

  /**
   * Report the masked address, never the full one: this screen is reachable with
   * a password alone, so it must not confirm which inbox the account uses.
   */
  return NextResponse.json({
    ok: true,
    delivered: issued.delivered,
    maskedEmail: maskEmail(user.email),
    ...(issued.devCode ? { devCode: issued.devCode } : {})
  });
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '•••';
  const head = local.slice(0, 1);
  const tail = local.length > 2 ? local.slice(-1) : '';
  return `${head}${'•'.repeat(Math.max(2, local.length - 2))}${tail}@${domain}`;
}
