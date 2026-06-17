import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import {
  investorSessionForbiddenResponse,
  requireInvestorSession
} from '../../../../../lib/onboarding/requireInvestorSession';
import { confirmCartBatchByProvider, loadCartBatchIntentsAnyStatus } from '../../../../../lib/payments/cartCheckoutService';
import {
  isMercadoPagoEmbeddedConfigured,
  processMercadoPagoEmbeddedPayment
} from '../../../../../lib/payments/mercadoPagoEmbeddedService';
import { confirmPlatformDeposit } from '../../../../../lib/payments/platformWalletService';
import { confirmPaymentIntent } from '../../../../../lib/payments/paymentService';

export const dynamic = 'force-dynamic';

type ProcessBody = {
  formData?: Record<string, unknown>;
  externalReference?: string;
  amountUsd?: number;
  referenceType?: 'deposit' | 'cart' | 'payment_intent';
  batchId?: string;
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
    const body = (await request.json()) as ProcessBody;
    const formData = body.formData;
    const externalReference = body.externalReference?.trim();

    if (!formData || !externalReference) {
      return NextResponse.json({ error: 'INVALID_PAYMENT_PAYLOAD' }, { status: 400 });
    }

    let amountUsd = body.amountUsd;
    let metadata: Record<string, unknown> = { userId: ctx.userId };
    let referenceType = body.referenceType;

    const deposit = await prisma.platformDeposit.findFirst({
      where: { id: externalReference, userId: ctx.userId }
    });
    if (deposit) {
      referenceType = 'deposit';
      amountUsd = amountUsd ?? deposit.amountUsd.toNumber();
      metadata = {
        ...metadata,
        depositId: deposit.id,
        paymentOptionId: (deposit.metadata as Record<string, unknown>)?.paymentOptionId ?? null
      };
    } else {
      const paymentIntent = await prisma.paymentIntent.findFirst({
        where: { id: externalReference, userId: ctx.userId }
      });
      if (paymentIntent) {
        const intentMeta = (paymentIntent.metadata as Record<string, unknown>) ?? {};
        const cartBatchId =
          typeof intentMeta.cartBatchId === 'string' ? intentMeta.cartBatchId : body.batchId?.trim();
        referenceType = cartBatchId ? 'cart' : 'payment_intent';
        amountUsd = amountUsd ?? paymentIntent.amountUsd.toNumber();
        metadata = {
          ...metadata,
          paymentIntentId: paymentIntent.id,
          cartBatchId: cartBatchId ?? null,
          projectId: paymentIntent.projectId
        };
      } else if (body.batchId) {
        const intents = await loadCartBatchIntentsAnyStatus(ctx.userId, body.batchId);
        if (!intents.length) {
          return NextResponse.json({ error: 'REFERENCE_NOT_FOUND' }, { status: 404 });
        }
        referenceType = 'cart';
        amountUsd = amountUsd ?? intents.reduce((sum, row) => sum + row.amountUsd.toNumber(), 0);
        metadata = {
          ...metadata,
          cartBatchId: body.batchId,
          paymentIntentIds: intents.map((row) => row.id).join(',')
        };
      } else {
        return NextResponse.json({ error: 'REFERENCE_NOT_FOUND' }, { status: 404 });
      }
    }

    if (!amountUsd || !Number.isFinite(amountUsd) || amountUsd <= 0) {
      return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 });
    }

    const payment = await processMercadoPagoEmbeddedPayment({
      formData,
      externalReference,
      amountUsd,
      payerEmail: ctx.email,
      idempotencyKey: `${ctx.userId}:${externalReference}:${Date.now()}`,
      metadata
    });

    if (payment.ok === false) {
      return NextResponse.json({ error: payment.error, details: payment.details }, { status: 502 });
    }

    if (referenceType === 'deposit' && deposit) {
      if (payment.approved) {
        const confirmed = await confirmPlatformDeposit({
          depositId: deposit.id,
          provider: 'mercado_pago',
          providerPaymentId: payment.paymentId,
          metadata: { status: payment.status, embedded: true }
        });
        return NextResponse.json({
          ok: true,
          status: payment.status,
          approved: true,
          deposit: confirmed
        });
      }

      return NextResponse.json({
        ok: true,
        status: payment.status,
        approved: false,
        pending: payment.pending,
        depositId: deposit.id
      });
    }

    const cartBatchId =
      typeof metadata.cartBatchId === 'string' ? metadata.cartBatchId : body.batchId?.trim();
    if (referenceType === 'cart' && cartBatchId && payment.approved) {
      const paymentIntents = await confirmCartBatchByProvider({
        batchId: cartBatchId,
        provider: 'mercado_pago',
        providerPaymentId: payment.paymentId,
        payload: { status: payment.status, embedded: true }
      });
      return NextResponse.json({
        ok: true,
        status: payment.status,
        approved: true,
        batchId: cartBatchId,
        paymentIntents
      });
    }

    if (referenceType === 'payment_intent' && payment.approved) {
      const paymentIntent = await confirmPaymentIntent({
        paymentIntentId: externalReference,
        provider: 'mercado_pago',
        providerPaymentId: payment.paymentId,
        payload: { status: payment.status, embedded: true }
      });
      return NextResponse.json({
        ok: true,
        status: payment.status,
        approved: true,
        paymentIntent
      });
    }

    return NextResponse.json({
      ok: true,
      status: payment.status,
      approved: payment.approved,
      pending: payment.pending,
      paymentId: payment.paymentId,
      batchId: cartBatchId ?? null
    });
  } catch (error) {
    console.error('[payments/mercadopago/process]', error);
    return NextResponse.json({ error: 'PAYMENT_PROCESS_FAILED' }, { status: 500 });
  }
}
