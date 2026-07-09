import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { prisma } from '@sanova/database';

/**
 * TOTP is fully opt-in (desktop only) — never mandatory. Users can always
 * disable it from account settings using their current code.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ totpEnabled: false, totpMandatory: false });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpEnabled: true, totpSecret: true }
  });

  return NextResponse.json({
    totpEnabled: user?.totpEnabled ?? false,
    totpMandatory: false,
    pendingSetup: Boolean(user?.totpSecret && !user?.totpEnabled)
  });
}
