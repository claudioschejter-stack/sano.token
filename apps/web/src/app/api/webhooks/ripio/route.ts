import { NextResponse } from 'next/server';
import { resolveCheckoutReferenceByRipioExternalRef, resolveExpectedAmountUsd } from '../../../../lib/payments/checkoutReferenceResolver';
import { settleOnRampCheckout } from '../../../../lib/payments/checkoutTreasurySettlement';
import { verifyRipioWebhookSignature } from '../../../../lib/payments/ripioClient';

export const dynamic = 'force-dynamic';

const COMPLETED_EVENTS = new Set(['ON-RAMP.WITHDRAWAL.COMPLETED']);
const FAILED_EVENTS = new Set(['ON-RAMP.ORDER.CANCELLED', 'ON-RAMP.ORDER.REFUNDED']);

export async function POST(request: Request) {
  const payload = await request.text();
  const signature =
    request.headers.get('http-x-wh-signature-256') ?? request.headers.get('Http-X-Wh-Signature-256');

  if (
    !verifyRipioWebhookSignature({
      secret: process.env.RIPIO_WEBHOOK_SECRET,
      payload,
      signature
    })
  ) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  const event = JSON.parse(payload) as {
    eventType?: string;
    transactionObject?: {
      externalRef?: string;
      transactionId?: string;
      status?: string;
      txnHash?: string | null;
    };
  };

  const eventType = event.eventType?.trim() ?? '';
  const transaction = event.transactionObject;
  const externalRef = transaction?.externalRef?.trim();

  if (!externalRef) {
    return NextResponse.json({ ok: true, ignored: 'missing_external_ref' });
  }

  if (FAILED_EVENTS.has(eventType)) {
    return NextResponse.json({ ok: true, ignored: eventType });
  }

  if (!COMPLETED_EVENTS.has(eventType)) {
    return NextResponse.json({ ok: true, ignored: eventType || 'pending' });
  }

  const reference = await resolveCheckoutReferenceByRipioExternalRef(externalRef);
  if (!reference) {
    return NextResponse.json({ ok: true, ignored: 'reference_not_found' });
  }

  const expectedAmountUsd = await resolveExpectedAmountUsd(reference);

  const result = await settleOnRampCheckout({
    reference,
    provider: 'ripio',
    providerPaymentId: transaction?.transactionId ?? externalRef,
    treasuryTxnHash: transaction?.txnHash ?? null,
    expectedAmountUsd,
    payload: event as Record<string, unknown>
  });

  return NextResponse.json({ ok: true, result });
}
