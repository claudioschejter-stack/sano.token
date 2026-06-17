import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import {
  investorSessionForbiddenResponse,
  requireInvestorSession
} from '../../../../../lib/onboarding/requireInvestorSession';
import { loadCartBatchIntentsAnyStatus } from '../../../../../lib/payments/cartCheckoutService';
import {
  createMercadoPagoEmbeddedPreference,
  isMercadoPagoEmbeddedConfigured
} from '../../../../../lib/payments/mercadoPagoEmbeddedService';

export const dynamic = 'force-dynamic';

type PreferenceBody = {
  referenceType?: 'deposit' | 'cart';
  referenceId?: string;
  amountUsd?: number;
};

export async function POST(request: Request) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  if (!isMercadoPagoEmbeddedConfigured()) {
    return NextResponse.json({ error: 'MERCADOPAGO_EMBEDDED_NOT_CONFIGURED' }, { status: 503 });
  }

  try {
    const body = (await request.json()) as PreferenceBody;
    const referenceType = body.referenceType;
    const referenceId = body.referenceId?.trim();

    if (!referenceType || !referenceId) {
      return NextResponse.json({ error: 'REFERENCE_REQUIRED' }, { status: 400 });
    }

    if (referenceType === 'deposit') {
      const deposit = await prisma.platformDeposit.findFirst({
        where: { id: referenceId, userId: ctx.userId }
      });
      if (!deposit) {
        return NextResponse.json({ error: 'DEPOSIT_NOT_FOUND' }, { status: 404 });
      }
      if (deposit.status !== 'PENDING') {
        return NextResponse.json({ error: 'DEPOSIT_NOT_PENDING' }, { status: 400 });
      }

      const metadata = (deposit.metadata as Record<string, unknown>) ?? {};
      const label =
        typeof metadata.paymentLabel === 'string' ? metadata.paymentLabel : 'Depósito Sanova';
      const amountUsd = body.amountUsd ?? deposit.amountUsd.toNumber();

      const preference = await createMercadoPagoEmbeddedPreference({
        externalReference: deposit.id,
        amountUsd,
        title: label,
        metadata: {
          depositId: deposit.id,
          userId: ctx.userId,
          paymentOptionId: metadata.paymentOptionId ?? null
        }
      });

      if (preference.ok === false) {
        return NextResponse.json({ error: preference.error }, { status: 502 });
      }

      await prisma.platformDeposit.update({
        where: { id: deposit.id },
        data: {
          providerPaymentId: preference.session.preferenceId,
          metadata: {
            ...metadata,
            provider: preference.session
          }
        }
      });

      return NextResponse.json({ ok: true, session: preference.session });
    }

    const intents = await loadCartBatchIntentsAnyStatus(ctx.userId, referenceId);
    if (!intents.length) {
      return NextResponse.json({ error: 'CART_BATCH_NOT_FOUND' }, { status: 404 });
    }

    const totalUsd =
      body.amountUsd ??
      intents.reduce((sum, intent) => sum + intent.amountUsd.toNumber(), 0);
    const totalTokens = intents.reduce((sum, intent) => sum + intent.tokenCount, 0);
    const primaryIntentId = intents[0].id;

    const preference = await createMercadoPagoEmbeddedPreference({
      externalReference: primaryIntentId,
      amountUsd: totalUsd,
      title: `Sanova RWA cart (${totalTokens} tokens)`,
      metadata: {
        cartBatchId: referenceId,
        paymentIntentIds: intents.map((row) => row.id).join(','),
        userId: ctx.userId
      }
    });

    if (preference.ok === false) {
      return NextResponse.json({ error: preference.error }, { status: 502 });
    }

    for (const intent of intents) {
      const prior = (intent.metadata as Record<string, unknown>) ?? {};
      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          provider: 'mercado_pago',
          providerPaymentId: preference.session.preferenceId,
          metadata: {
            ...prior,
            gateway: preference.session
          }
        }
      });
    }

    return NextResponse.json({ ok: true, session: preference.session });
  } catch (error) {
    console.error('[payments/mercadopago/preference]', error);
    return NextResponse.json({ error: 'PREFERENCE_CREATE_FAILED' }, { status: 500 });
  }
}
