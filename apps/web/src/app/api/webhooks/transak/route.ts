import { NextResponse } from 'next/server';
import { resolveCheckoutReferenceByPartnerOrderId, resolveExpectedAmountUsd } from '../../../../lib/payments/checkoutReferenceResolver';
import { settleOnRampCheckout } from '../../../../lib/payments/checkoutTreasurySettlement';
import { verifyHmacSignature } from '../../../../lib/payments/webhookSecurity';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get('x-transak-signature');

  if (
    !verifyHmacSignature({
      secret: process.env.TRANSAK_WEBHOOK_SECRET,
      payload,
      signature
    })
  ) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  const event = JSON.parse(payload) as {
    eventID?: string;
    status?: string;
    partnerOrderId?: string;
    webhookData?: {
      id?: string;
      status?: string;
      partnerOrderId?: string;
      transactionHash?: string;
    };
  };

  const partnerOrderId = event.partnerOrderId || event.webhookData?.partnerOrderId;
  const status = (event.status || event.webhookData?.status || '').toUpperCase();

  if (!partnerOrderId) {
    return NextResponse.json({ ok: true, ignored: 'missing_partner_order_id' });
  }

  if (status !== 'COMPLETED' && status !== 'SUCCESS' && status !== 'PAID') {
    return NextResponse.json({ ok: true, ignored: status || 'unknown_status' });
  }

  const reference = await resolveCheckoutReferenceByPartnerOrderId(partnerOrderId);
  if (!reference) {
    return NextResponse.json({ ok: true, ignored: 'reference_not_found' });
  }

  const expectedAmountUsd = await resolveExpectedAmountUsd(reference);

  const result = await settleOnRampCheckout({
    reference,
    provider: 'transak',
    providerPaymentId: event.eventID || event.webhookData?.id || partnerOrderId,
    treasuryTxnHash: event.webhookData?.transactionHash ?? null,
    expectedAmountUsd,
    payload: event as Record<string, unknown>
  });

  return NextResponse.json({ ok: true, result });
}
