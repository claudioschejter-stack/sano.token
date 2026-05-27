import { NextResponse } from 'next/server';
import { confirmPlatformDeposit } from '../../../../lib/payments/platformWalletService';
import { verifyHmacSignature } from '../../../../lib/payments/webhookSecurity';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get('x-transak-signature');

  if (
    process.env.TRANSAK_WEBHOOK_SECRET &&
    !verifyHmacSignature({
      secret: process.env.TRANSAK_WEBHOOK_SECRET,
      payload,
      signature
    })
  ) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  const event = JSON.parse(payload) as {
    eventID?: string;
    status?: string;
    partnerOrderId?: string;
    webhookData?: { id?: string; status?: string; partnerOrderId?: string };
  };

  const partnerOrderId = event.partnerOrderId || event.webhookData?.partnerOrderId;
  const status = (event.status || event.webhookData?.status || '').toUpperCase();

  if (!partnerOrderId) {
    return NextResponse.json({ ok: true, ignored: 'missing_partner_order_id' });
  }

  if (status === 'COMPLETED' || status === 'SUCCESS' || status === 'PAID') {
    const deposit = await confirmPlatformDeposit({
      depositId: partnerOrderId,
      provider: 'transak',
      providerPaymentId: event.eventID || event.webhookData?.id,
      metadata: event
    });
    return NextResponse.json({ ok: true, deposit });
  }

  return NextResponse.json({ ok: true, ignored: status || 'unknown_status' });
}
