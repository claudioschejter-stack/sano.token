import { NextResponse } from 'next/server';
import { confirmPaymentIntent, markPaymentIntentFailed } from '../../../../lib/payments/paymentService';
import { verifyHmacSignature } from '../../../../lib/payments/webhookSecurity';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get('x-signature');

  if (!verifyHmacSignature({ secret: process.env.MERCADOPAGO_WEBHOOK_SECRET, payload, signature })) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  const event = JSON.parse(payload) as {
    type?: string;
    action?: string;
    data?: { id?: string };
    external_reference?: string;
    metadata?: { paymentIntentId?: string };
    status?: string;
  };

  const paymentIntentId = event.metadata?.paymentIntentId || event.external_reference;
  if (!paymentIntentId) {
    return NextResponse.json({ ok: true, ignored: 'missing_payment_intent' });
  }

  const paid = event.status === 'approved' || event.action === 'payment.updated' || event.type === 'payment';
  const failed = ['rejected', 'cancelled', 'refunded', 'charged_back'].includes(event.status ?? '');

  if (paid) {
    const paymentIntent = await confirmPaymentIntent({
      paymentIntentId,
      provider: 'mercado_pago',
      providerPaymentId: event.data?.id,
      payload: event
    });
    return NextResponse.json({ ok: true, paymentIntent });
  }

  if (failed) {
    const paymentIntent = await markPaymentIntentFailed({
      paymentIntentId,
      provider: 'mercado_pago',
      providerPaymentId: event.data?.id,
      payload: event
    });
    return NextResponse.json({ ok: true, paymentIntent });
  }

  return NextResponse.json({ ok: true, ignored: event.action ?? event.type });
}
