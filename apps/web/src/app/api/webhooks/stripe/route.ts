import { NextResponse } from 'next/server';
import { confirmPaymentIntent, markPaymentIntentFailed } from '../../../../lib/payments/paymentService';
import { confirmCartBatchByProvider } from '../../../../lib/payments/cartCheckoutService';
import { confirmPlatformDeposit } from '../../../../lib/payments/platformWalletService';
import { verifyStripeSignature } from '../../../../lib/payments/webhookSecurity';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!verifyStripeSignature({ secret: process.env.STRIPE_WEBHOOK_SECRET, payload, signature })) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  const event = JSON.parse(payload) as {
    type?: string;
    data?: {
      object?: {
        id?: string;
        client_reference_id?: string;
        metadata?: Record<string, string>;
      };
    };
  };

  const object = event.data?.object;
  const depositId = object?.metadata?.depositId;
  const cartBatchId = object?.metadata?.cartBatchId;
  const paymentIntentId = object?.metadata?.paymentIntentId || object?.client_reference_id;

  if (depositId && (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded')) {
    const deposit = await confirmPlatformDeposit({
      depositId,
      provider: 'stripe',
      providerPaymentId: object?.id,
      metadata: event
    });
    return NextResponse.json({ ok: true, deposit });
  }

  if (cartBatchId && (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded')) {
    const paymentIntents = await confirmCartBatchByProvider({
      batchId: cartBatchId,
      provider: 'stripe',
      providerPaymentId: object?.id,
      payload: event
    });
    return NextResponse.json({ ok: true, paymentIntents });
  }

  if (!paymentIntentId) {
    return NextResponse.json({ ok: true, ignored: 'missing_reference' });
  }

  if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
    const paymentIntent = await confirmPaymentIntent({
      paymentIntentId,
      provider: 'stripe',
      providerPaymentId: object?.id,
      payload: event
    });
    return NextResponse.json({ ok: true, paymentIntent });
  }

  if (event.type === 'checkout.session.expired' || event.type === 'payment_intent.payment_failed') {
    const paymentIntent = await markPaymentIntentFailed({
      paymentIntentId,
      provider: 'stripe',
      providerPaymentId: object?.id,
      payload: event
    });
    return NextResponse.json({ ok: true, paymentIntent });
  }

  return NextResponse.json({ ok: true, ignored: event.type });
}
