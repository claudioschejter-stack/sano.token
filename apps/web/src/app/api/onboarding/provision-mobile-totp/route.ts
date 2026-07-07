import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { prisma } from '@sanova/database';
import {
  generateBackupCodes,
  hashBackupCodes
} from '../../../../lib/auth/totpService';
import { encryptTotpSetupSecret, resolveTotpSetup } from '../../../../lib/auth/totpSetup';
import { syncUserAccountStatus } from '../../../../lib/onboarding/syncUserAccount';

/**
 * Mobile onboarding: provision Google Authenticator for future desktop login
 * without asking for a 6-digit code on the phone.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      emailVerifiedAt: true,
      totpEnabled: true,
      totpSecret: true,
      registrationChannel: true
    }
  });

  if (!user?.emailVerifiedAt) {
    return NextResponse.json({ error: 'EMAIL_VERIFICATION_REQUIRED' }, { status: 403 });
  }

  if (user.registrationChannel === 'desktop-web') {
    return NextResponse.json({ error: 'DESKTOP_REGISTRATION' }, { status: 400 });
  }

  if (user.totpEnabled) {
    return NextResponse.json({ ok: true, alreadyEnabled: true });
  }

  const setup = resolveTotpSetup({
    email: user.email,
    totpSecret: user.totpSecret,
    totpEnabled: user.totpEnabled,
    force: false
  });

  if ('error' in setup) {
    return NextResponse.json({ error: setup.error }, { status: 400 });
  }

  const plainCodes = generateBackupCodes();
  const hashed = await hashBackupCodes(plainCodes);

  await prisma.$transaction([
    prisma.backupCode.deleteMany({ where: { userId: session.user.id } }),
    prisma.backupCode.createMany({
      data: hashed.map((codeHash) => ({ userId: session.user.id!, codeHash }))
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        totpSecret: encryptTotpSetupSecret(setup.secret),
        totpEnabled: true,
        failed2faAttempts: 0,
        locked2faUntil: null
      }
    })
  ]);

  await syncUserAccountStatus(session.user.id);

  return NextResponse.json({
    ok: true,
    uri: setup.uri,
    backupCodes: plainCodes
  });
}
