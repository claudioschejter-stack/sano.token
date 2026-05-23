import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { extractDiditIdentity } from '../../../../lib/onboarding/extractDiditIdentity';
import { mapDiditStatusToKyc, verifyDiditWebhookSignature } from '../../../../lib/onboarding/diditService';
import { isContactVerificationComplete } from '../../../../lib/onboarding/contactVerification';
import { syncUserAccountStatus } from '../../../../lib/onboarding/syncUserAccount';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature =
    request.headers.get('x-signature-v2') ?? request.headers.get('X-Signature-V2');

  if (
    !verifyDiditWebhookSignature(rawBody, signature, process.env.DIDIT_WEBHOOK_SECRET)
  ) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

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
      phone: true
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
      ...(identity.fullName ? { kycFullName: identity.fullName, name: identity.fullName } : {}),
      ...(identity.documentId ? { kycDocumentId: identity.documentId } : {})
    }
  });

  await syncUserAccountStatus(vendorData);

  return NextResponse.json({ ok: true });
}
