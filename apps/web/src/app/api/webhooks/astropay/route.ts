import { NextResponse } from 'next/server';
import { dispatchPaymentWebhook } from '../../../../lib/payments/paymentWebhookDispatch';
import { verifyHmacSignature } from '../../../../lib/payments/webhookSecurity';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get('x-signature') ?? request.headers.get('x-astropay-signature');

  if (
    !verifyHmacSignature({
      secret: process.env.ASTROPAY_WEBHOOK_SECRET ?? process.env.ASTROPAY_API_KEY,
      payload,
      signature
    })
  ) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  const event = JSON.parse(payload) as {
    status?: string;
    external_reference?: string;
    merchant_deposit_id?: string;
    deposit_external_id?: string;
    id?: string;
  };

  const externalReference =
    event.external_reference ?? event.merchant_deposit_id ?? event.deposit_external_id ?? event.id ?? '';
  const status = event.status?.toUpperCase() ?? '';
  const paid = status === 'APPROVED' || status === 'COMPLETED' || status === 'SUCCESS' || status === 'PAID';
  const failed = ['REJECTED', 'CANCELLED', 'FAILED', 'EXPIRED'].includes(status);

  const result = await dispatchPaymentWebhook({
    externalReference,
    provider: 'astropay',
    providerPaymentId: event.id,
    paid,
    failed,
    payload: { ...event, provider: 'astropay' }
  });

  return NextResponse.json(result);
}
