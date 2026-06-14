import { NextResponse } from 'next/server';
import { prisma, type Prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';
import { confirmCartBatchByProvider } from '../../../../../lib/payments/cartCheckoutService';
import { confirmPaymentIntent } from '../../../../../lib/payments/paymentService';
import { confirmPlatformDeposit } from '../../../../../lib/payments/platformWalletService';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const paymentIntents = await prisma.paymentIntent.findMany({
    where: { status: 'MANUAL_REVIEW' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      userId: true,
      projectId: true,
      method: true,
      status: true,
      amountUsd: true,
      tokenCount: true,
      provider: true,
      metadata: true,
      createdAt: true,
      expiresAt: true
    }
  });

  const deposits = await prisma.platformDeposit.findMany({
    where: { status: 'MANUAL_REVIEW' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      userId: true,
      status: true,
      amountUsd: true,
      method: true,
      provider: true,
      metadata: true,
      createdAt: true,
      expiresAt: true
    }
  });

  return NextResponse.json({
    ok: true,
    paymentIntents: paymentIntents.map((row) => ({
      ...row,
      amountUsd: row.amountUsd.toString(),
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString()
    })),
    deposits: deposits.map((row) => ({
      ...row,
      amountUsd: row.amountUsd.toString(),
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString()
    }))
  });
}

type ReconcileBody = {
  paymentIntentId?: string;
  depositId?: string;
  cartBatchId?: string;
  provider?: string;
  providerPaymentId?: string;
  note?: string;
};

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = (await request.json()) as ReconcileBody;
  const provider = body.provider?.trim() || 'manual_reconciliation';
  const payload = {
    reconciledBy: session.user?.email ?? session.user?.id,
    note: body.note ?? null,
    reconciledAt: new Date().toISOString()
  };

  if (body.cartBatchId?.trim()) {
    const paymentIntents = await confirmCartBatchByProvider({
      batchId: body.cartBatchId.trim(),
      provider,
      providerPaymentId: body.providerPaymentId,
      payload
    });
    return NextResponse.json({ ok: true, paymentIntents });
  }

  if (body.depositId?.trim()) {
    const deposit = await confirmPlatformDeposit({
      depositId: body.depositId.trim(),
      provider,
      providerPaymentId: body.providerPaymentId,
      metadata: payload
    });
    return NextResponse.json({ ok: true, deposit });
  }

  if (body.paymentIntentId?.trim()) {
    const paymentIntent = await confirmPaymentIntent({
      paymentIntentId: body.paymentIntentId.trim(),
      provider,
      providerPaymentId: body.providerPaymentId,
      payload
    });
    return NextResponse.json({ ok: true, paymentIntent });
  }

  return NextResponse.json({ error: 'MISSING_REFERENCE' }, { status: 400 });
}
