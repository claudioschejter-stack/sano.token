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
  // Treasury Swap model: fiat remains at Mercado Pago; backend delivers USDC/tokens from treasury reserve.
  // TODO: Ejecutar Smart Contract — mintTokens(userAddress, amount) on Base (chainId 8453)
  // Example with viem/ethers after resolving the investor embedded wallet:
  //   const userAddress = await resolveInvestorWalletFromMetadata(payment.metadata);
  //   const tokenAmount = resolveSanovaTokenAmount(payment.metadata?.amountUsd ?? payment.transaction_amount);
  //   await mintTokens(userAddress, tokenAmount);
  return {
    ok: true,
    status: 'approved_pending_onchain_mint',
    paymentId: payment.id ?? null,
    externalReference: payment.external_reference ?? null
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
