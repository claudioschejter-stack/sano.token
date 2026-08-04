import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { getLinkedWalletForUser } from '../../../../lib/investor/linkedWalletPolicy';
import { closeStaleOpenCartBatches } from '../../../../lib/payments/closeStaleCartBatches';
import {
  autoReconcileTreasuryPaymentForUser,
  findReconcilableCartBatches,
  findTreasuryPaymentsFromWallet,
  pickBatchForPayment,
  reconcileCartBatchWithTxHash
} from '../../../../lib/payments/reconcileCryptoSettlement';
import { findPendingUsdcCartPurchase } from '../../../../lib/payments/privyInboundUsdcService';
import { refundCryptoPurchase } from '../../../../lib/payments/refundCryptoPurchase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

async function resolveUserId(input: { userId?: string | null; email?: string | null }) {
  const userId = input.userId?.trim();
  if (userId) return userId;
  const email = input.email?.trim();
  if (!email) return '';
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true }
  });
  return user?.id ?? '';
}

/**
 * Admin: inspect an investor's open USDC cart and the treasury payments their
 * Sanova wallet already sent, so a lost settle can be reconciled.
 * `GET /api/admin/crypto-reconcile?email=…`
 */
export async function GET(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const userId = await resolveUserId({
    userId: url.searchParams.get('userId'),
    email: url.searchParams.get('email')
  });
  if (!userId) {
    return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
  }

  const payer = await getLinkedWalletForUser(userId);
  const pending = await findPendingUsdcCartPurchase(userId);
  const openBatches = await findReconcilableCartBatches(userId);
  const payments = payer
    ? await findTreasuryPaymentsFromWallet({ payerAddress: payer }).catch(() => [])
    : [];

  const usedHashes = (
    await prisma.paymentIntent.findMany({
      where: { userId, txHash: { not: null } },
      select: { txHash: true }
    })
  )
    .map((row) => row.txHash?.toLowerCase())
    .filter((hash): hash is string => Boolean(hash));

  return NextResponse.json({
    ok: true,
    userId,
    payerAddress: payer,
    pendingBatch: pending,
    // Includes batches past their TTL — those still need crediting if paid.
    openBatches,
    treasuryPayments: payments.map((row) => ({
      ...row,
      alreadyUsed: usedHashes.includes(row.txHash.toLowerCase())
    }))
  });
}

/**
 * Admin: confirm a cart batch already paid on-chain.
 * Body: `{ email | userId, txHash?, batchId?, action?: 'auto' }`
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    userId?: string;
    email?: string;
    txHash?: string;
    batchId?: string;
    action?: 'auto' | 'close_stale' | 'refund';
    reason?: string;
    refundTxHash?: string;
  };

  const userId = await resolveUserId({ userId: body.userId, email: body.email });
  if (!userId) {
    return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
  }

  try {
    if (body.action === 'refund') {
      if (!body.batchId?.trim()) {
        return NextResponse.json({ error: 'BATCH_ID_REQUIRED' }, { status: 400 });
      }
      const refund = await refundCryptoPurchase({
        userId,
        batchId: body.batchId.trim(),
        reason: body.reason?.trim() || 'DELIVERY_FAILED',
        refundTxHash: body.refundTxHash?.trim() || null
      });
      return NextResponse.json({ ok: true, action: 'refund', refund });
    }

    if (body.action === 'close_stale') {
      const closed = await closeStaleOpenCartBatches({
        userId,
        keepBatchId: body.batchId,
        reason: 'ADMIN_CLOSE_STALE'
      });
      return NextResponse.json({ ok: true, action: 'close_stale', closed });
    }

    if (body.txHash?.trim()) {
      const txHash = body.txHash.trim();
      let batchId = body.batchId?.trim() || '';

      if (!batchId) {
        const payer = await getLinkedWalletForUser(userId);
        const payments = payer
          ? await findTreasuryPaymentsFromWallet({ payerAddress: payer }).catch(() => [])
          : [];
        const paidUsdc =
          payments.find((row) => row.txHash.toLowerCase() === txHash.toLowerCase())?.amountUsdc ??
          null;

        // Expired batches must still be creditable: the money already moved.
        const batches = await findReconcilableCartBatches(userId);
        const picked = pickBatchForPayment({ batches, paidUsdc });
        batchId = picked?.batchId ?? '';

        if (!batchId) {
          return NextResponse.json(
            { error: 'NO_RECONCILABLE_BATCH', paidUsdc, openBatches: batches },
            { status: 400 }
          );
        }
      }

      const intents = await reconcileCartBatchWithTxHash({ userId, batchId, txHash });
      return NextResponse.json({ ok: true, batchId, intents });
    }

    const result = await autoReconcileTreasuryPaymentForUser(userId);
    const status = result.status === 'CONFIRMED' ? 200 : 409;
    return NextResponse.json({ ok: result.status === 'CONFIRMED', result }, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RECONCILE_FAILED';
    console.error('[admin/crypto-reconcile]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
