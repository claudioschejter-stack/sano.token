import { NextResponse } from 'next/server';

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

function verifyModoSignature(request: Request, _rawBody: string): boolean {
  const secret = process.env.MODO_WEBHOOK_SECRET?.trim();
  if (!secret) {
    // If no secret is configured, allow the request (dev / initial setup).
    // TODO: Once MODO provides the signing secret, enforce HMAC verification here.
    return true;
  }

  // MODO uses an x-modo-signature header with HMAC-SHA256 of the raw body.
  const signature = request.headers.get('x-modo-signature') ?? request.headers.get('x-signature');
  if (!signature) return false;

  // HMAC verification would go here once MODO_WEBHOOK_SECRET is confirmed:
  // const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  // return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

  return true;
}

async function handleApprovedModoPayment(data: ModoPaymentData) {
  // Treasury Swap model: ARS lands at MODO merchant account;
  // backend delivers USDC from treasury reserve to the investor's wallet.
  //
  // TODO: Resolve investor wallet from reference and trigger on-chain delivery:
  //   const { walletAddress, amountUsdc } = await resolveDepositFromReference(data.reference);
  //   await deliverUsdcFromTreasury(walletAddress, amountUsdc);

  console.info('[webhook/modo] Payment approved', {
    paymentId: data.paymentId,
    amount: data.amount,
    currency: data.currency,
    reference: data.reference
  });

  return {
    ok: true,
    status: 'approved_pending_usdc_delivery',
    paymentId: data.paymentId ?? null,
    reference: data.reference ?? null
  };
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
