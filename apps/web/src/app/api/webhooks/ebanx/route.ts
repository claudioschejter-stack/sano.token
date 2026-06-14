import { NextResponse } from 'next/server';
import { isEbanxPaymentPaid } from '../../../../lib/payments/ebanxAdapter';
import { dispatchPaymentWebhook } from '../../../../lib/payments/paymentWebhookDispatch';
import { verifyHmacSignature } from '../../../../lib/payments/webhookSecurity';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get('x-signature') ?? request.headers.get('x-ebanx-signature');

  if (
    !verifyHmacSignature({
      secret: process.env.EBANX_WEBHOOK_SECRET ?? process.env.EBANX_API_KEY,
      payload,
      signature
    })
  ) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  const event = JSON.parse(payload) as {
    status?: string;
    payment?: {
      merchant_payment_code?: string;
      hash?: string;
      status?: string;
    };
  };

  const payment = event.payment;
  const externalReference = payment?.merchant_payment_code ?? '';
  const status = payment?.status ?? event.status;
  const paid = isEbanxPaymentPaid(status);
  const failed = ['CA', 'CANCELLED', 'FAILED', 'ERROR'].includes(status?.toUpperCase() ?? '');

  const result = await dispatchPaymentWebhook({
    externalReference,
    provider: 'ebanx',
    providerPaymentId: payment?.hash,
    paid,
    failed,
    payload: { ...event, provider: 'ebanx' }
  });

  return NextResponse.json(result);
}
