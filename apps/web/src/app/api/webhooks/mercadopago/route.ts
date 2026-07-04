import { NextResponse } from 'next/server';
import { markPaymentIntentFailed } from '../../../../lib/payments/paymentService';
import { dispatchApprovedLocalWalletPayment } from '../../../../lib/payments/localWalletWebhookSettlement';
import { mercadoPagoWebhookSecret } from '../../../../lib/payments/mercadoPagoClient';
import {
  handleMercadoPagoQrOrderWebhook,
  isMercadoPagoQrOrderWebhookEvent
} from '../../../../lib/payments/mercadoPagoQr/webhookHandler';
import { handleMercadoPagoPixWebhookIfTracked } from '../../../../lib/payments/mercadoPagoPix/webhookHandler';
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
    transaction_amount?: number;
    metadata?: {
      paymentIntentId?: string;
      cartBatchId?: string;
      depositId?: string;
      userId?: string;
      amountUsd?: number;
    };
  };
}

async function handleApprovedMercadoPagoPayment(payment: {
  id?: string | number;
  status?: string;
  external_reference?: string;
  transaction_amount?: number;
  metadata?: Record<string, unknown>;
}) {
  const metadata = payment.metadata ?? {};
  const amountUsd =
    typeof metadata.amountUsd === 'number'
      ? metadata.amountUsd
      : typeof payment.transaction_amount === 'number'
        ? payment.transaction_amount
        : null;

  return dispatchApprovedLocalWalletPayment({
    externalReference: payment.external_reference,
    provider: 'mercado_pago',
    providerPaymentId: payment.id !== undefined ? String(payment.id) : null,
    amountUsd,
    payload: {
      ...metadata,
      external_reference: payment.external_reference,
      transaction_amount: payment.transaction_amount,
      paymentId: payment.id ?? null,
      status: payment.status ?? 'approved'
    }
  });
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
      secret: mercadoPagoWebhookSecret() ?? undefined,
      signature,
      requestId,
      dataId
    })
  ) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  if (isMercadoPagoQrOrderWebhookEvent(event)) {
    const qrResult = await handleMercadoPagoQrOrderWebhook(event);
    return NextResponse.json(qrResult);
  }

  // Pix payments (Brazil) are created via mercadoPagoPix and tracked locally by
  // mpPaymentId; handle them separately since they use external_reference (not
  // payment.metadata) to carry the deposit/cart batch reference.
  if (event.data?.id && (event.type === 'payment' || event.action === 'payment.updated')) {
    const pixResult = await handleMercadoPagoPixWebhookIfTracked(String(event.data.id));
    if (!('ignored' in pixResult)) {
      return NextResponse.json(pixResult);
    }
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
  const approved = payment.status === 'approved';
  const failed = ['rejected', 'cancelled', 'refunded', 'charged_back'].includes(payment.status ?? '');

  if (approved) {
    const settlement = await handleApprovedMercadoPagoPayment({
      id: payment.data?.id,
      status: payment.status,
      external_reference: payment.external_reference,
      transaction_amount: (payment as { transaction_amount?: number }).transaction_amount,
      metadata: payment.metadata as Record<string, unknown> | undefined
    });
    return NextResponse.json(settlement);
  }

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
