import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { recordAdminAuditLog } from '../../../../lib/admin/assetsService';
import { safeLogId } from '../../../../lib/logging/safeLogValue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Admin: what is blocking a user's second factor.
 * `GET /api/admin/totp-reset?email=…`
 */
export async function GET(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const email = new URL(request.url).searchParams.get('email')?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: 'EMAIL_REQUIRED' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      totpEnabled: true,
      totpSecret: true,
      failed2faAttempts: true,
      locked2faUntil: true,
      backupCodes: { select: { usedAt: true } }
    }
  });

  if (!user) {
    return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
  }

  const lockedUntil = user.locked2faUntil;
  const locked = Boolean(lockedUntil && lockedUntil > new Date());

  return NextResponse.json({
    ok: true,
    email: user.email,
    totpEnabled: user.totpEnabled,
    hasSecret: Boolean(user.totpSecret),
    failedAttempts: user.failed2faAttempts,
    locked,
    lockedUntil: lockedUntil?.toISOString() ?? null,
    lockedSecondsLeft: locked ? Math.ceil((lockedUntil!.getTime() - Date.now()) / 1000) : 0,
    /**
     * The escape hatch, and whether it is still there. A user with no unused
     * backup codes and a phone that no longer produces valid ones has no way
     * back in on their own.
     */
    backupCodesLeft: user.backupCodes.filter((row) => !row.usedAt).length
  });
}

/**
 * Admin: unlock a user's second factor.
 *
 * `{ email, mode: 'unlock' | 'reset' }`
 *
 * Someone who loses their phone and their backup codes is locked out for good:
 * `reset-setup` needs a session they cannot get, and it refuses once TOTP is
 * enabled. Until now the only way back was running a script against the
 * production database, which is not something support can do.
 *
 * `unlock` clears the failed-attempt lockout and keeps the existing secret, for
 * the common case of someone who just typed a stale code five times. `reset`
 * drops the secret and the backup codes so the next login enrolls again — which
 * is why it is a separate, explicit mode rather than the default.
 */
export async function POST(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    mode?: string;
  };

  const email = body.email?.trim().toLowerCase();
  const mode = body.mode?.trim() === 'reset' ? 'reset' : 'unlock';

  if (!email) {
    return NextResponse.json({ error: 'EMAIL_REQUIRED' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, totpEnabled: true }
  });

  if (!user) {
    return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
  }

  try {
    if (mode === 'reset') {
      await prisma.$transaction([
        prisma.backupCode.deleteMany({ where: { userId: user.id } }),
        prisma.user.update({
          where: { id: user.id },
          data: {
            totpSecret: null,
            totpEnabled: false,
            failed2faAttempts: 0,
            locked2faUntil: null
          }
        })
      ]);
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { failed2faAttempts: 0, locked2faUntil: null }
      });
    }

    await recordAdminAuditLog({
      actorUserId: (session as { user?: { id?: string } }).user?.id ?? null,
      action: mode === 'reset' ? 'TOTP_RESET' : 'TOTP_UNLOCK',
      targetUserId: user.id,
      metadata: { email: user.email, previousTotpEnabled: user.totpEnabled }
    });

    return NextResponse.json({
      ok: true,
      mode,
      email: user.email,
      detail:
        mode === 'reset'
          ? 'Se borró el segundo factor y los códigos de respaldo: el próximo login lo vuelve a configurar desde cero.'
          : 'Se limpió el bloqueo por intentos fallidos. El mismo authenticator sigue siendo válido.'
    });
  } catch (error) {
    console.error('[admin/totp-reset]', safeLogId(email), error);
    return NextResponse.json({ error: 'TOTP_RESET_FAILED' }, { status: 500 });
  }
}
