import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { resolveCheckoutReferenceByRipioExternalRef, resolveExpectedAmountUsd } from '../../../../lib/payments/checkoutReferenceResolver';
import { settleOnRampCheckout } from '../../../../lib/payments/checkoutTreasurySettlement';
import { verifyRipioWebhookSignature } from '../../../../lib/payments/ripioClient';
import { linkFiatIdentity } from '../../../../lib/investor/linkedFiatIdentityService';

export const dynamic = 'force-dynamic';

const COMPLETED_EVENTS = new Set(['ON-RAMP.WITHDRAWAL.COMPLETED']);
const FAILED_EVENTS = new Set(['ON-RAMP.ORDER.CANCELLED', 'ON-RAMP.ORDER.REFUNDED']);

async function resolveUserIdFromReference(
  reference: NonNullable<Awaited<ReturnType<typeof resolveCheckoutReferenceByRipioExternalRef>>>
): Promise<{ userId: string; email: string | null; capturedFrom: string } | null> {
  if (reference.kind === 'deposit') {
    const deposit = await prisma.platformDeposit.findUnique({
      where: { id: reference.depositId },
      select: { userId: true }
    });
    if (!deposit) return null;
    const user = await prisma.user.findUnique({
      where: { id: deposit.userId },
      select: { email: true }
    });
    return { userId: deposit.userId, email: user?.email ?? null, capturedFrom: reference.depositId };
  }

  if (reference.kind === 'cart' || reference.kind === 'payment_intent') {
    const user = await prisma.user.findUnique({
      where: { id: reference.userId },
      select: { email: true }
    });
    return {
      userId: reference.userId,
      email: user?.email ?? null,
      capturedFrom: reference.kind === 'cart' ? reference.batchId : reference.intentId
    };
  }

  return null;
}

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

  if (FAILED_EVENTS.has(eventType)) {
    return NextResponse.json({ ok: true, ignored: eventType });
  }

  if (!COMPLETED_EVENTS.has(eventType)) {
    return NextResponse.json({ ok: true, ignored: eventType || 'pending' });
  }

  const reference = await resolveCheckoutReferenceByRipioExternalRef(externalRef);
  if (!reference) {
    return NextResponse.json({ ok: true, ignored: 'reference_not_found' });
  }

  const expectedAmountUsd = await resolveExpectedAmountUsd(reference);

  const result = await settleOnRampCheckout({
    reference,
    provider: 'ripio',
    providerPaymentId: transaction?.transactionId ?? externalRef,
    treasuryTxnHash: transaction?.txnHash ?? null,
    expectedAmountUsd,
    payload: event as Record<string, unknown>
  });

  // Ripio on-ramp does not always expose a separate payer id; link the Sanova
  // account email as the fiat identity so withdrawals can offer a quick-select chip.
  try {
    const owner = await resolveUserIdFromReference(reference);
    if (owner?.email) {
      await linkFiatIdentity({
        userId: owner.userId,
        provider: 'ripio',
        identifier: owner.email,
        label: owner.email,
        capturedFrom: owner.capturedFrom
      });
    }
  } catch (error) {
    console.error('[webhooks/ripio] linkFiatIdentity failed', error);
  }

  return NextResponse.json({ ok: true, result });
}
