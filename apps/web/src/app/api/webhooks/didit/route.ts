import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { extractDiditIdentity, buildDiditIdentityUpdate } from '../../../../lib/onboarding/extractDiditIdentity';
import { mapDiditStatusToKyc, verifyDiditWebhookSignature } from '../../../../lib/onboarding/diditService';
import { isContactVerificationComplete } from '../../../../lib/onboarding/contactVerification';
import { syncUserAccountStatus } from '../../../../lib/onboarding/syncUserAccount';
import { provisionInvestorProfileOnKycApproval } from '../../../../lib/investor/provisionInvestorProfile';
import { autoAllowlistInvestorWallet } from '../../../../lib/blockchain/autoAllowlistInvestorWallet';

/** Max age in seconds for Didit webhook replay-protection (X-Timestamp header). */
const WEBHOOK_MAX_AGE_SEC = 300;

export async function POST(request: Request) {
  const rawBody = await request.text();

  // 1. Timestamp freshness — reject replays older/newer than 300s
  const tsHeader = request.headers.get('x-timestamp');
  const ts = tsHeader ? Number(tsHeader) : null;
  if (ts !== null && !Number.isNaN(ts)) {
    const ageSec = Math.abs(Date.now() / 1000 - ts);
    if (ageSec > WEBHOOK_MAX_AGE_SEC) {
      return NextResponse.json({ error: 'STALE_TIMESTAMP' }, { status: 401 });
    }
  }

  // 2. Signature — X-Signature-V2 canonical HMAC-SHA256
  const signature =
    request.headers.get('x-signature-v2') ?? request.headers.get('X-Signature-V2');

  if (
    !verifyDiditWebhookSignature(rawBody, signature, process.env.DIDIT_WEBHOOK_SECRET)
  ) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  // 3. Parse body
  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const vendorData =
    (payload.vendor_data as string | undefined) ??
    (payload.vendorData as string | undefined) ??
    (payload.user_id as string | undefined);

  const status =
    (payload.status as string | undefined) ??
    (payload.decision as string | undefined) ??
    ((payload.session as Record<string, unknown> | undefined)?.status as string | undefined);

  const sessionId =
    (payload.session_id as string | undefined) ??
    (payload.sessionId as string | undefined) ??
    ((payload.session as Record<string, unknown> | undefined)?.id as string | undefined);

  if (!vendorData) {
    return NextResponse.json({ ok: true, skipped: 'no_vendor_data' });
  }

  const kycStatus = mapDiditStatusToKyc(status);
  const identity = extractDiditIdentity(payload);

  const existingUser = await prisma.user.findUnique({
    where: { id: vendorData },
    select: {
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      phone: true,
      systemRole: true
    }
  });

  if (!existingUser || !isContactVerificationComplete(existingUser)) {
    return NextResponse.json({ ok: true, skipped: 'contact_not_verified' });
  }

  await prisma.user.update({
    where: { id: vendorData },
    data: {
      kycStatus,
      kycProviderId: sessionId ?? undefined,
      diditSessionId: sessionId ?? undefined,
      ...buildDiditIdentityUpdate(identity)
    }
  });

  await syncUserAccountStatus(vendorData);

  if (kycStatus === 'APPROVED') {
    await provisionInvestorProfileOnKycApproval(vendorData);
    const { notifyAdvisorOfClientKycApproved } = await import(
      '../../../../lib/advisor/advisorNotificationService'
    );
    void notifyAdvisorOfClientKycApproved(vendorData);
    // Auto-whitelist investor wallet on all active on-chain token contracts
    void autoAllowlistInvestorWallet(vendorData);
  }

  return NextResponse.json({ ok: true });
}
