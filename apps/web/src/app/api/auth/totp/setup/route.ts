import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { prisma } from '@sanova/database';
import { encryptTotpSetupSecret, resolveTotpSetup } from '../../../../../lib/auth/totpSetup';

/**
 * POST /api/auth/totp/setup
 * Genera o reutiliza un secret TOTP pendiente de confirmación.
 * Body opcional: { force?: boolean }
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'NO_AUTENTICADO' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { force?: boolean };
  const force = Boolean(body.force);
  const userId = session.user.id;
  const email = session.user.email ?? userId;

  const resolved = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true, totpSecret: true, totpEnabled: true }
    });

    if (!user?.emailVerifiedAt) {
      return { error: 'EMAIL_VERIFICATION_REQUIRED' as const };
    }

    const setup = resolveTotpSetup({
      email,
      totpSecret: user.totpSecret,
      totpEnabled: user.totpEnabled,
      force
    });

    if ('error' in setup) {
      return { error: 'YA_ACTIVADO' as const };
    }

    if (!setup.reused) {
      await tx.user.update({
        where: { id: userId },
        data: { totpSecret: encryptTotpSetupSecret(setup.secret) }
      });
    }

    return setup;
  });

  if ('error' in resolved) {
    if (resolved.error === 'EMAIL_VERIFICATION_REQUIRED') {
      return NextResponse.json({ error: resolved.error }, { status: 403 });
    }
    return NextResponse.json({ error: 'YA_ACTIVADO' }, { status: 400 });
  }

  return NextResponse.json({
    uri: resolved.uri,
    secret: resolved.secret,
    secretHint: resolved.secretHint,
    reused: resolved.reused
  });
}
