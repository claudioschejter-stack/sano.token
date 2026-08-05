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
  /** Bridge issues one virtual account per customer; this says which received it. */
  virtual_account_id?: string;
  virtual_account?: { id?: string };
  customer_id?: string;
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

  /**
   * No usable reference, but Bridge issues one virtual account per customer, so
   * the account that received the wire says who sent it. That is a stronger
   * signal than a memo the sender has to type correctly, and it was being
   * discarded: the deposit was ignored and nobody knew it had arrived.
   */
  if (paid && !paymentReference && !batchId) {
    const attributed = await attributeByVirtualAccount(data, event);
    if (attributed) {
      return NextResponse.json(attributed);
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

/**
 * Attribute a wire by the virtual account that received it.
 *
 * Settles the investor's open order when there is exactly one; otherwise the
 * payment lands in the unmatched inbox already tied to a person, which is the
 * hard part of reconciling a wire. Guessing between two open orders would
 * credit the wrong one.
 */
async function attributeByVirtualAccount(
  data: BridgeEventObject,
  event: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const virtualAccountId = pickString(
    data.virtual_account_id,
    (data.virtual_account as { id?: string } | undefined)?.id
  );
  const bridgeCustomerId = pickString(data.customer_id);
  if (!virtualAccountId && !bridgeCustomerId) {
    return null;
  }

  const { resolveVirtualAccountOwner, resolveOpenBatchForUser } = await import(
    '../../../../lib/payments/bridgeVirtualAccountRegistry'
  );
  const owner = await resolveVirtualAccountOwner({ virtualAccountId, bridgeCustomerId });
  if (!owner) {
    return null;
  }

  const providerPaymentId =
    pickString(data.id, data.deposit_id) ?? `bridge-${owner.virtualAccountId}-${Date.now()}`;
  const batchId = await resolveOpenBatchForUser(owner.userId);

  if (batchId) {
    const { dispatchPaymentWebhook: dispatch } = await import(
      '../../../../lib/payments/paymentWebhookDispatch'
    );
    const result = await dispatch({
      externalReference: batchId,
      provider: 'bridge',
      providerPaymentId,
      paid: true,
      failed: false,
      payload: { ...event, provider: 'bridge', attributedByVirtualAccount: owner.virtualAccountId }
    });
    return { ...result, attributedBy: 'virtual_account', userId: owner.userId };
  }

  const { recordUnmatchedPayment } = await import('../../../../lib/payments/unmatchedPayments');
  const rawAmount = pickAmount(data.amount_usdc, data.usdc_amount, data.amount);
  const amount = Number(rawAmount ?? 0);
  await recordUnmatchedPayment({
    provider: 'bridge',
    providerPaymentId,
    externalReference: owner.virtualAccountId,
    amount,
    currency: 'USD',
    payload: { ...event, userId: owner.userId, virtualAccountId: owner.virtualAccountId }
  });

  return {
    ok: true,
    parked: 'no_single_open_order',
    userId: owner.userId,
    virtualAccountId: owner.virtualAccountId
  };
}
