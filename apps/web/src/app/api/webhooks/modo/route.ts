import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { dispatchApprovedLocalWalletPayment } from '../../../../lib/payments/localWalletWebhookSettlement';

export const dynamic = 'force-dynamic';

/**
 * MODO Interoperable Payment Webhook
 *
 * MODO notifies this endpoint when an interoperable QR payment changes state.
 * Register this URL in the MODO merchant portal:
 *   https://sanovacapital.com/api/webhooks/modo
 *
 * MODO webhook event shape (v1):
 * {
 *   "event": "payment.approved" | "payment.rejected" | "payment.expired",
 *   "data": {
 *     "paymentId": "string",
 *     "merchantId": "string",
 *     "status": "approved" | "rejected" | "expired" | "pending",
 *     "amount": number,          // ARS
 *     "currency": "ARS",
 *     "reference": "string",     // matches our referenceId / concepto
 *     "payer": { "name": "string", "cuit": "string" },
 *     "createdAt": "ISO8601",
 *     "updatedAt": "ISO8601"
 *   }
 * }
 */

type ModoPaymentData = {
  paymentId?: string;
  merchantId?: string;
  status?: string;
  amount?: number;
  currency?: string;
  reference?: string;
  payer?: { name?: string; cuit?: string };
  createdAt?: string;
  updatedAt?: string;
};

type ModoEvent = {
  event?: string;
  data?: ModoPaymentData;
};

function verifyModoSignature(request: Request, rawBody: string): boolean {
  const secret = process.env.MODO_WEBHOOK_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[webhook/modo] MODO_WEBHOOK_SECRET not configured');
      return false;
    }
    return true;
  }

  const signature = request.headers.get('x-modo-signature') ?? request.headers.get('x-signature');
  if (!signature) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    const provided = Buffer.from(signature.trim());
    const expectedBuffer = Buffer.from(expected);
    if (provided.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(provided, expectedBuffer);
  } catch {
    return signature.trim() === expected;
  }
}

async function handleApprovedModoPayment(data: ModoPaymentData) {
  return dispatchApprovedLocalWalletPayment({
    externalReference: data.reference,
    provider: 'modo',
    providerPaymentId: data.paymentId ?? data.reference ?? null,
    amountUsd: typeof data.amount === 'number' ? data.amount : null,
    payload: {
      ...data,
      reference: data.reference,
      paymentId: data.paymentId,
      amount: data.amount,
      currency: data.currency,
      status: data.status ?? 'approved'
    }
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!verifyModoSignature(request, rawBody)) {
    console.warn('[webhook/modo] Invalid signature');
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  let event: ModoEvent = {};
  try {
    event = JSON.parse(rawBody || '{}') as ModoEvent;
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const { event: eventType, data } = event;
  const status = data?.status ?? '';

  console.info('[webhook/modo] Received event', { eventType, status, reference: data?.reference });

  if (status === 'approved' || eventType === 'payment.approved') {
    const result = await handleApprovedModoPayment(data ?? {});
    return NextResponse.json(result);
  }

  if (['rejected', 'expired', 'cancelled'].includes(status) || eventType?.startsWith('payment.rejected')) {
    console.info('[webhook/modo] Payment not completed', {
      paymentId: data?.paymentId,
      status,
      reference: data?.reference
    });
    return NextResponse.json({ ok: true, status: 'not_completed', eventType });
  }

  // Pending or unknown events — acknowledge receipt
  return NextResponse.json({ ok: true, received: true, eventType });
}

/** MODO may send a GET to verify the webhook URL is reachable */
export async function GET() {
  return NextResponse.json({ ok: true, service: 'sanova-modo-webhook' });
}
