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

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerifiedAt: true, totpSecret: true, totpEnabled: true }
  });

  if (!user?.emailVerifiedAt) {
    return NextResponse.json({ error: 'EMAIL_VERIFICATION_REQUIRED' }, { status: 403 });
  }

  const email = session.user.email ?? session.user.id;
  const resolved = resolveTotpSetup({
    email,
    totpSecret: user.totpSecret,
    totpEnabled: user.totpEnabled,
    force: Boolean(body.force)
  });

  if ('error' in resolved) {
    return NextResponse.json({ error: 'YA_ACTIVADO' }, { status: 400 });
  }

  if (!resolved.reused) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { totpSecret: encryptTotpSetupSecret(resolved.secret) }
    });
  }

  return NextResponse.json({
    uri: resolved.uri,
    secret: resolved.secret,
    secretHint: resolved.secretHint,
    reused: resolved.reused
  });
}
