import { prisma } from '@sanova/database';
import { notifyAutomationIssue } from '../admin/automationAlerts';
import { deliverVaultSharesForPaymentIntent } from '../blockchain/investorVaultShareDelivery';
import { expirePaymentIntent } from './paymentService';

function isUndeliveredVaultPurchase(metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata || metadata.purchaseMode !== 'ERC4626_DEPOSIT') {
    return false;
  }
  if (
    metadata.vaultShareDeliveryStatus === 'DELIVERED' ||
    metadata.vaultShareDeliveryStatus === 'DELIVERED_ONCHAIN' ||
    (typeof metadata.vaultShareDeliveryTxHash === 'string' && metadata.vaultShareDeliveryTxHash.trim())
  ) {
    return false;
  }
  if (metadata.vaultShareDeliveryStatus === 'IN_PROGRESS') {
    const startedAt = metadata.vaultShareDeliveryStartedAt;
    if (typeof startedAt === 'string' && Date.now() - Date.parse(startedAt) < 2 * 60 * 1000) {
      return false;
    }
  }
  return true;
}

export async function retryUndeliveredVaultShares(limit = 25) {
  const candidates = await prisma.paymentIntent.findMany({
    where: { status: 'CONFIRMED' },
    orderBy: { confirmedAt: 'asc' },
    take: limit * 4
  });

  const pending = candidates
    .filter((intent) => isUndeliveredVaultPurchase(intent.metadata as Record<string, unknown>))
    .slice(0, limit);

  const results = [];
  for (const intent of pending) {
    try {
      const outcome = await deliverVaultSharesForPaymentIntent(intent.id);
      results.push({ id: intent.id, outcome });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'DELIVERY_RETRY_FAILED';
      results.push({ id: intent.id, outcome: { status: 'FAILED', code: message } });
    }
  }

  return { attempted: results.length, results };
}

export async function reconcilePayments(limit = 50) {
  const stale = await prisma.paymentIntent.findMany({
    where: {
      status: 'REQUIRES_PAYMENT',
      expiresAt: { lte: new Date() }
    },
    take: limit,
    orderBy: { expiresAt: 'asc' }
  });

  const expired = [];
  for (const intent of stale) {
    const updated = await expirePaymentIntent(intent.id);
    expired.push({ id: intent.id, status: updated?.status ?? 'UNKNOWN' });
  }

  const suspicious = await prisma.paymentIntent.findMany({
    where: {
      status: 'CONFIRMED',
      investmentId: null
    },
    take: limit
  });

  for (const intent of suspicious) {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: 'MANUAL_REVIEW',
        metadata: {
          ...((intent.metadata as Record<string, unknown>) ?? {}),
          reconciliation: { reason: 'CONFIRMED_WITHOUT_INVESTMENT' }
        }
      }
    });
    await notifyAutomationIssue({
      projectId: intent.projectId,
      title: `Pago en revisión (${intent.id})`,
      message: 'La reconciliación detectó un pago confirmado sin inversión asociada.'
    });
  }

  return { expired, suspicious: suspicious.map((intent) => intent.id), vaultShareRetries: await retryUndeliveredVaultShares(limit) };
}
