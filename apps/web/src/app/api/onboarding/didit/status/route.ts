import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { mapDiditStatusToKyc, retrieveDiditDecision } from '../../../../../lib/onboarding/diditService';
import { requireAuthenticatedSession } from '../../../../../lib/onboarding/requireAuthenticatedSession';
import { ingestDiditDecision } from '../../../../../lib/onboarding/kycIngestionService';

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

  let decision: Awaited<ReturnType<typeof retrieveDiditDecision>>;
  try {
    decision = await retrieveDiditDecision(user.diditSessionId);
  } catch (error) {
    console.error('[onboarding/didit/status] retrieveDiditDecision failed', error);
    return NextResponse.json({ error: 'DIDIT_STATUS_UNAVAILABLE' }, { status: 502 });
  }

  const status = (decision.status as string | undefined) ?? (decision.decision as string | undefined);
  const kycStatus = mapDiditStatusToKyc(status);

  if (kycStatus !== user.kycStatus && kycStatus !== 'PENDING') {
    try {
      await ingestDiditDecision({
        userId: ctx.userId,
        sessionId: user.diditSessionId,
        kycStatus,
        decisionPayload: decision
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN';
      console.error('[onboarding/didit/status] ingestDiditDecision failed', error);

      if (message === 'DOCUMENT_ALREADY_REGISTERED') {
        return NextResponse.json({ error: message }, { status: 409 });
      }

      return NextResponse.json({ error: 'KYC_SYNC_FAILED' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, kycStatus, diditStatus: status ?? null });
}
