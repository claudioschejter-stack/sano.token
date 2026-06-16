import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { confirmPlatformDeposit } from '../../../../lib/payments/platformWalletService';
import { verifyRipioWebhookSignature } from '../../../../lib/payments/ripioClient';

export const dynamic = 'force-dynamic';

const COMPLETED_EVENTS = new Set(['ON-RAMP.WITHDRAWAL.COMPLETED']);
const FAILED_EVENTS = new Set(['ON-RAMP.ORDER.CANCELLED', 'ON-RAMP.ORDER.REFUNDED']);

export async function POST(request: Request) {
  const payload = await request.text();
  const signature =
    request.headers.get('http-x-wh-signature-256') ?? request.headers.get('Http-X-Wh-Signature-256');

  if (
    !verifyRipioWebhookSignature({
      secret: process.env.RIPIO_WEBHOOK_SECRET,
      payload,
      signature
    })
  ) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  const event = JSON.parse(payload) as {
    eventType?: string;
    transactionObject?: {
      externalRef?: string;
      transactionId?: string;
      status?: string;
      txnHash?: string | null;
    };
  };

  const eventType = event.eventType?.trim() ?? '';
  const transaction = event.transactionObject;
  const externalRef = transaction?.externalRef?.trim();

  if (!externalRef) {
    return NextResponse.json({ ok: true, ignored: 'missing_external_ref' });
  }

  const deposit = await prisma.platformDeposit.findFirst({
    where: {
      metadata: {
        path: ['ripioExternalRef'],
        equals: externalRef
      }
    }
  });

  if (!deposit) {
    return NextResponse.json({ ok: true, ignored: 'deposit_not_found' });
  }

  if (COMPLETED_EVENTS.has(eventType)) {
    const confirmed = await confirmPlatformDeposit({
      depositId: deposit.id,
      provider: 'ripio',
      providerPaymentId: transaction?.transactionId ?? externalRef,
      metadata: {
        ...event,
        ripioTxnHash: transaction?.txnHash ?? null
      }
    });
    return NextResponse.json({ ok: true, deposit: confirmed });
  }

  if (FAILED_EVENTS.has(eventType)) {
    return NextResponse.json({ ok: true, ignored: eventType });
  }

  return NextResponse.json({ ok: true, ignored: eventType || 'pending' });
}
