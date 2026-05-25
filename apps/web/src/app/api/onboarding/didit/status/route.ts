import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { extractDiditIdentity, buildDiditIdentityUpdate } from '../../../../../lib/onboarding/extractDiditIdentity';
import { mapDiditStatusToKyc, retrieveDiditDecision } from '../../../../../lib/onboarding/diditService';
import { requireAuthenticatedSession } from '../../../../../lib/onboarding/requireAuthenticatedSession';
import { syncUserAccountStatus } from '../../../../../lib/onboarding/syncUserAccount';

export async function POST() {
  const ctx = await requireAuthenticatedSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: {
      diditSessionId: true,
      kycStatus: true
    }
  });

  if (!user?.diditSessionId) {
    return NextResponse.json({ error: 'DIDIT_SESSION_NOT_FOUND' }, { status: 404 });
  }

  try {
    const decision = await retrieveDiditDecision(user.diditSessionId);
    const status = (decision.status as string | undefined) ?? (decision.decision as string | undefined);
    const kycStatus = mapDiditStatusToKyc(status);

    if (kycStatus !== user.kycStatus || kycStatus !== 'PENDING') {
      const identity = extractDiditIdentity(decision);

      await prisma.user.update({
        where: { id: ctx.userId },
        data: {
          kycStatus,
          kycProviderId: user.diditSessionId,
          ...buildDiditIdentityUpdate(identity)
        }
      });

      await syncUserAccountStatus(ctx.userId);
    }

    return NextResponse.json({ ok: true, kycStatus, diditStatus: status ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    console.error('[onboarding/didit/status]', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
