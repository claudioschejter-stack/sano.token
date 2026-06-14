import { NextResponse } from 'next/server';
import { confirmPaymentIntent, markPaymentIntentFailed } from '../../../../lib/payments/paymentService';
import { confirmCartBatchByProvider } from '../../../../lib/payments/cartCheckoutService';
import { confirmPlatformDeposit } from '../../../../lib/payments/platformWalletService';
import { verifyHmacSignature } from '../../../../lib/payments/webhookSecurity';

export const dynamic = 'force-dynamic';

async function fetchMercadoPagoPayment(paymentId: string) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!accessToken || !paymentId) {
    return null;
  }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as {
    id?: string | number;
    status?: string;
    external_reference?: string;
    metadata?: { paymentIntentId?: string; cartBatchId?: string; depositId?: string };
  };
}

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
    metadata?: { paymentIntentId?: string; cartBatchId?: string; depositId?: string };
    status?: string;
  };

  let payment = event;
  if (event.data?.id && (event.type === 'payment' || event.action === 'payment.updated')) {
    const fetched = await fetchMercadoPagoPayment(String(event.data.id));
    if (fetched) {
      payment = {
        ...event,
        status: fetched.status,
        external_reference: fetched.external_reference,
        metadata: fetched.metadata,
        data: { id: String(fetched.id ?? event.data.id) }
      };
    }
  }

  const cartBatchId = payment.metadata?.cartBatchId;
  const depositId = payment.metadata?.depositId;
  const paymentIntentId = payment.metadata?.paymentIntentId || payment.external_reference;

  if (depositId) {
    const paid = payment.status === 'approved';
    const failed = ['rejected', 'cancelled', 'refunded', 'charged_back'].includes(payment.status ?? '');

    if (paid) {
      const deposit = await confirmPlatformDeposit({
        depositId,
        provider: 'mercado_pago',
        providerPaymentId: payment.data?.id,
        metadata: payment
      });
      return NextResponse.json({ ok: true, deposit });
    }

    if (failed) {
      return NextResponse.json({ ok: true, ignored: 'deposit_failed' });
    }
  }

  if (cartBatchId) {
    const paid = payment.status === 'approved' || payment.action === 'payment.updated' || payment.type === 'payment';
    const failed = ['rejected', 'cancelled', 'refunded', 'charged_back'].includes(payment.status ?? '');

    if (paid) {
      const paymentIntents = await confirmCartBatchByProvider({
        batchId: cartBatchId,
        provider: 'mercado_pago',
        providerPaymentId: payment.data?.id,
        payload: payment
      });
      return NextResponse.json({ ok: true, paymentIntents });
    }

    if (failed && paymentIntentId) {
      const paymentIntent = await markPaymentIntentFailed({
        paymentIntentId,
        provider: 'mercado_pago',
        providerPaymentId: payment.data?.id,
        payload: payment
      });
      return NextResponse.json({ ok: true, paymentIntent });
    }
  }

  if (!paymentIntentId) {
    return NextResponse.json({ ok: true, ignored: 'missing_payment_intent' });
  }

  const paid = payment.status === 'approved' || payment.action === 'payment.updated' || payment.type === 'payment';
  const failed = ['rejected', 'cancelled', 'refunded', 'charged_back'].includes(payment.status ?? '');

  if (paid) {
    const paymentIntent = await confirmPaymentIntent({
      paymentIntentId,
      provider: 'mercado_pago',
      providerPaymentId: payment.data?.id,
      payload: payment
    });
    return NextResponse.json({ ok: true, paymentIntent });
  }

  if (failed) {
    const paymentIntent = await markPaymentIntentFailed({
      paymentIntentId,
      provider: 'mercado_pago',
      providerPaymentId: payment.data?.id,
      payload: payment
    });
    return NextResponse.json({ ok: true, paymentIntent });
  }

  return NextResponse.json({ ok: true, ignored: payment.action ?? payment.type });
}
