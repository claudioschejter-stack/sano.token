import { NextResponse } from 'next/server';
import { confirmPaymentIntent, markPaymentIntentFailed } from '../../../../lib/payments/paymentService';
import { verifyCoinbaseSignature } from '../../../../lib/payments/webhookSecurity';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get('x-cc-webhook-signature');

  if (!verifyCoinbaseSignature({ secret: process.env.COINBASE_COMMERCE_WEBHOOK_SECRET, payload, signature })) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  const event = JSON.parse(payload) as {
    event?: {
      type?: string;
      data?: {
        id?: string;
        metadata?: { paymentIntentId?: string };
      };
    };
  };

  const type = event.event?.type;
  const data = event.event?.data;
  const paymentIntentId = data?.metadata?.paymentIntentId;

  if (!paymentIntentId) {
    return NextResponse.json({ ok: true, ignored: 'missing_payment_intent' });
  }

  if (type === 'charge:confirmed' || type === 'charge:resolved') {
    const paymentIntent = await confirmPaymentIntent({
      paymentIntentId,
      provider: 'coinbase',
      providerPaymentId: data?.id,
      payload: event
    });
    return NextResponse.json({ ok: true, paymentIntent });
  }

  if (type === 'charge:failed' || type === 'charge:delayed') {
    const paymentIntent = await markPaymentIntentFailed({
      paymentIntentId,
      provider: 'coinbase',
      providerPaymentId: data?.id,
      payload: event
    });
    return NextResponse.json({ ok: true, paymentIntent });
  }

  return NextResponse.json({ ok: true, ignored: type });
}
