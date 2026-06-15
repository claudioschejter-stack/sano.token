import { NextResponse } from 'next/server';
import { isDLocalPaymentPaid, parseDLocalAuthorizationHeader, verifyDLocalWebhookSignature } from '../../../../lib/payments/dlocalAdapter';
import { dispatchPaymentWebhook } from '../../../../lib/payments/paymentWebhookDispatch';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const payload = await request.text();
  const signature =
    parseDLocalAuthorizationHeader(request.headers.get('authorization')) ??
    request.headers.get('x-signature');
  const login = request.headers.get('x-login');
  const date = request.headers.get('x-date');

  if (!verifyDLocalWebhookSignature({ login, date, signature, payload })) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  const event = JSON.parse(payload) as {
    order_id?: string;
    id?: string;
    status?: string;
    metadata?: Record<string, unknown>;
  };

  const externalReference = event.order_id ?? event.id ?? '';
  const paid = isDLocalPaymentPaid(event.status);
  const failed = ['REJECTED', 'CANCELLED', 'EXPIRED', 'FAILED'].includes(event.status?.toUpperCase() ?? '');

  const result = await dispatchPaymentWebhook({
    externalReference,
    provider: 'dlocal',
    providerPaymentId: event.id,
    paid,
    failed,
    payload: { ...event, provider: 'dlocal' }
  });

  return NextResponse.json(result);
}
