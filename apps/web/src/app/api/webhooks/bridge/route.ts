import { NextResponse } from 'next/server';
import { verifyHmacSignature } from '../../../../lib/payments/webhookSecurity';
import { dispatchPaymentWebhook } from '../../../../lib/payments/paymentWebhookDispatch';
import { handleYieldConversionWebhook } from '../../../../lib/yield/yieldWebhookHandler';

export const dynamic = 'force-dynamic';

/** Bridge.xyz webhooks: investor on-ramp + project yield conversion batches. */
export async function POST(request: Request) {
  const payload = await request.text();
  const signature =
    request.headers.get('x-bridge-signature') ??
    request.headers.get('x-webhook-signature') ??
    request.headers.get('x-signature');

  if (
    !verifyHmacSignature({
      secret: process.env.BRIDGE_WEBHOOK_SECRET,
      payload,
      signature
    })
  ) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  const event = JSON.parse(payload) as {
    type?: string;
    event?: string;
    status?: string;
    data?: {
      reference?: string;
      conversion_ref?: string;
      batch_id?: string;
      external_id?: string;
      amount_usdc?: number | string;
      usdc_amount?: number | string;
      tx_hash?: string;
      transaction_hash?: string;
    };
  };

  const data = event.data ?? {};
  const eventType = (event.type ?? event.event ?? event.status ?? '').toLowerCase();
  const paymentReference = data.external_id ?? data.reference ?? null;
  const conversionRef = data.reference ?? data.conversion_ref ?? null;
  const batchId = data.batch_id ?? null;

  if (paymentReference && !batchId) {
    const paid = eventType.includes('complete') || eventType.includes('success') || eventType.includes('paid');
    const failed = eventType.includes('fail') || eventType.includes('cancel');
    const paymentResult = await dispatchPaymentWebhook({
      externalReference: paymentReference,
      provider: 'bridge',
      providerPaymentId: paymentReference,
      paid,
      failed,
      payload: { ...event, provider: 'bridge' }
    });
    if (paymentResult.ok && !('ignored' in paymentResult)) {
      return NextResponse.json(paymentResult);
    }
  }

  if (!conversionRef && !batchId) {
    return NextResponse.json({ ok: true, ignored: 'missing_batch_reference' });
  }

  if (eventType.includes('fail') || eventType.includes('cancel')) {
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

  const usdcAmount = data.amount_usdc ?? data.usdc_amount;
  if (!usdcAmount && !eventType.includes('complete') && !eventType.includes('success')) {
    return NextResponse.json({ ok: true, ignored: eventType || 'pending' });
  }

  const result = await handleYieldConversionWebhook({
    batchId,
    conversionRef,
    usdcAmount,
    conversionTxHash: data.tx_hash ?? data.transaction_hash ?? null,
    provider: 'bridge',
    status: 'completed',
    payload: event as Record<string, unknown>
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 404 });
  }

  return NextResponse.json(result);
}
