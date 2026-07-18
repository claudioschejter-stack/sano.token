import { NextResponse } from 'next/server';
import { verifyBridgeWebhookSignature } from '../../../../lib/payments/webhookSecurity';
import { dispatchPaymentWebhook } from '../../../../lib/payments/paymentWebhookDispatch';
import { handleYieldConversionWebhook } from '../../../../lib/yield/yieldWebhookHandler';

export const dynamic = 'force-dynamic';

type BridgeEventObject = {
  id?: string;
  client_reference_id?: string;
  external_id?: string;
  reference?: string;
  conversion_ref?: string;
  batch_id?: string;
  amount?: string | number;
  amount_usdc?: number | string;
  usdc_amount?: number | string;
  receipt?: { destination_tx_hash?: string; transaction_hash?: string };
  destination_tx_hash?: string;
  transaction_hash?: string;
  tx_hash?: string;
  state?: string;
  status?: string;
  deposit_id?: string;
};

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function pickAmount(...values: unknown[]): number | string | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function isPaidState(value: string): boolean {
  return (
    value.includes('complete') ||
    value.includes('success') ||
    value.includes('paid') ||
    value.includes('payment_processed') ||
    value.includes('funds_received') ||
    value.includes('funds_delivered')
  );
}

function isFailedState(value: string): boolean {
  return value.includes('fail') || value.includes('cancel') || value.includes('refund');
}

/** Bridge.xyz webhooks: investor on-ramp + project yield conversion batches. */
export async function POST(request: Request) {
  const payload = await request.text();
  const signature =
    request.headers.get('x-webhook-signature') ??
    request.headers.get('x-bridge-signature') ??
    request.headers.get('x-signature');

  if (
    !verifyBridgeWebhookSignature({
      payload,
      signature,
      publicKey: process.env.BRIDGE_WEBHOOK_PUBLIC_KEY,
      legacyHmacSecret: process.env.BRIDGE_WEBHOOK_SECRET
    })
  ) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  const event = JSON.parse(payload) as {
    type?: string;
    event?: string;
    event_type?: string;
    status?: string;
    event_object?: BridgeEventObject;
    data?: BridgeEventObject;
  };

  const data = event.event_object ?? event.data ?? {};
  const eventType = (
    event.event_type ??
    event.type ??
    event.event ??
    event.status ??
    data.state ??
    data.status ??
    ''
  ).toLowerCase();

  const paymentReference = pickString(
    data.client_reference_id,
    data.external_id,
    typeof data.reference === 'string' &&
      (data.reference.startsWith('dep_') ||
        data.reference.startsWith('cart_') ||
        data.reference.startsWith('SANOVA'))
      ? data.reference
      : null
  );
  const conversionRef = pickString(data.conversion_ref, data.reference);
  const batchId = pickString(data.batch_id);
  const paid = isPaidState(eventType) || isPaidState(String(data.state ?? '').toLowerCase());
  const failed = isFailedState(eventType) || isFailedState(String(data.state ?? '').toLowerCase());

  if (paymentReference && !batchId) {
    const paymentResult = await dispatchPaymentWebhook({
      externalReference: paymentReference,
      provider: 'bridge',
      providerPaymentId: pickString(data.id, data.deposit_id, paymentReference) ?? paymentReference,
      paid,
      failed,
      payload: { ...event, provider: 'bridge' }
    });
    if (paymentResult.ok && !('ignored' in paymentResult)) {
      return NextResponse.json(paymentResult);
    }
  }

  if (!conversionRef && !batchId) {
    return NextResponse.json({ ok: true, ignored: eventType || 'unhandled_bridge_event' });
  }

  if (failed) {
    const result = await handleYieldConversionWebhook({
      batchId,
      conversionRef,
      provider: 'bridge',
      status: 'failed',
      error: eventType,
      payload: event as Record<string, unknown>
    });
    return NextResponse.json(result);
  }

  const usdcAmount = pickAmount(data.amount_usdc, data.usdc_amount, data.amount);
  if (!usdcAmount && !paid) {
    return NextResponse.json({ ok: true, ignored: eventType || 'pending' });
  }

  const result = await handleYieldConversionWebhook({
    batchId,
    conversionRef,
    usdcAmount,
    conversionTxHash:
      pickString(
        data.destination_tx_hash,
        data.transaction_hash,
        data.tx_hash,
        data.receipt?.destination_tx_hash,
        data.receipt?.transaction_hash
      ) ?? null,
    provider: 'bridge',
    status: 'completed',
    payload: event as Record<string, unknown>
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 404 });
  }

  return NextResponse.json(result);
}
