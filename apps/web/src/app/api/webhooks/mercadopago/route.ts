import { NextResponse } from 'next/server';
import { markPaymentIntentFailed } from '../../../../lib/payments/paymentService';
import { verifyMercadoPagoSignature } from '../../../../lib/payments/webhookSecurity';

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

function mercadoPagoWebhookDataId(request: Request, event: { data?: { id?: string | number } }): string | null {
  const url = new URL(request.url);
  const queryId = url.searchParams.get('data.id') ?? url.searchParams.get('id');
  if (queryId?.trim()) {
    return queryId.trim();
  }
  if (event.data?.id !== undefined && event.data?.id !== null) {
    return String(event.data.id);
  }
  return null;
}

/** MP ya no confirma compras ni depósitos: fiat→USDC Base se liquida vía Ripio + verificación on-chain. */
export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get('x-signature');
  const requestId = request.headers.get('x-request-id');

  const event = JSON.parse(payload || '{}') as {
    type?: string;
    action?: string;
    data?: { id?: string };
    external_reference?: string;
    metadata?: { paymentIntentId?: string; cartBatchId?: string; depositId?: string };
    status?: string;
  };

  const dataId = mercadoPagoWebhookDataId(request, event);
  if (
    !verifyMercadoPagoSignature({
      secret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
      signature,
      requestId,
      dataId
    })
  ) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

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
  const failed = ['rejected', 'cancelled', 'refunded', 'charged_back'].includes(payment.status ?? '');

  if (depositId) {
    return NextResponse.json({ ok: true, ignored: 'mp_deposit_settled_via_ripio_usdc' });
  }

  if (cartBatchId) {
    if (failed && paymentIntentId) {
      await markPaymentIntentFailed({
        paymentIntentId,
        provider: 'mercado_pago',
        providerPaymentId: payment.data?.id,
        payload: payment
      });
    }
    return NextResponse.json({ ok: true, ignored: 'mp_cart_disabled_use_onramp' });
  }

  if (paymentIntentId && failed) {
    const paymentIntent = await markPaymentIntentFailed({
      paymentIntentId,
      provider: 'mercado_pago',
      providerPaymentId: payment.data?.id,
      payload: payment
    });
    return NextResponse.json({ ok: true, paymentIntent });
  }

  return NextResponse.json({ ok: true, ignored: 'mp_purchase_disabled_use_onramp' });
}
