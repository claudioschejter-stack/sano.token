import { NextResponse } from 'next/server';
import { mapDiditStatusToKyc, verifyDiditWebhookSignature } from '../../../../lib/onboarding/diditService';
import { ingestDiditWebhook } from '../../../../lib/onboarding/kycIngestionService';

/** Max age in seconds for Didit webhook replay-protection (X-Timestamp header). */
const WEBHOOK_MAX_AGE_SEC = 300;

export async function POST(request: Request) {
  const rawBody = await request.text();

  const tsHeader = request.headers.get('x-timestamp');
  const ts = tsHeader ? Number(tsHeader) : null;
  if (ts !== null && !Number.isNaN(ts)) {
    const ageSec = Math.abs(Date.now() / 1000 - ts);
    if (ageSec > WEBHOOK_MAX_AGE_SEC) {
      return NextResponse.json({ error: 'STALE_TIMESTAMP' }, { status: 401 });
    }
  }

  const signature =
    request.headers.get('x-signature-v2') ?? request.headers.get('X-Signature-V2');

  if (!verifyDiditWebhookSignature(rawBody, signature, process.env.DIDIT_WEBHOOK_SECRET)) {
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

  const result = await ingestDiditWebhook({
    userId: vendorData,
    sessionId,
    kycStatus,
    payload
  });

  return NextResponse.json(result);
}
