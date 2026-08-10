import { prisma, type Prisma } from '@sanova/database';
import { notifyAutomationIssue } from '../admin/automationAlerts';
import { deliverVaultSharesForPaymentIntent } from '../blockchain/investorVaultShareDelivery';
import { expirePaymentIntent } from './paymentService';

export function isUndeliveredVaultPurchase(
  metadata: Record<string, unknown> | null | undefined
): boolean {
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

/**
 * Cerrar los depósitos que ya vencieron y a los que nunca llegó plata.
 *
 * `reconcilePayments` vencía los `PaymentIntent` pero nunca los
 * `PlatformDeposit`, así que había 18 en PENDING de hasta 72 días — todos
 * pasados de su propio `expiresAt`, sin txHash y sin un peso recibido. Un
 * depósito que quedó PENDING para siempre no es inofensivo: aparece en el panel
 * como si algo estuviera por pasar y contamina cualquier lectura de pagos sin
 * conciliar.
 *
 * Las condiciones son deliberadamente estrictas. Lo único que se cierra es lo que
 * venció sin dejar rastro de dinero: con un txHash, un `confirmedAt` o esperando
 * USDC en treasury, el depósito se queda como está, porque puede haber plata en
 * camino y vencerlo la escondería.
 */
export async function expireStalePlatformDeposits(limit = 100) {
  const stale = await prisma.platformDeposit.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { lte: new Date() },
      txHash: null,
      confirmedAt: null
    },
    select: { id: true, provider: true, metadata: true },
    take: limit,
    orderBy: { expiresAt: 'asc' }
  });

  const expired: string[] = [];
  const skipped: string[] = [];

  for (const deposit of stale) {
    const metadata = (deposit.metadata as Record<string, unknown>) ?? {};
    if (metadata.awaitingTreasuryUsdc === true) {
      // El fiat ya se cobró y el USDC está en camino: no es basura, es una espera.
      skipped.push(deposit.id);
      continue;
    }

    await prisma.platformDeposit.update({
      where: { id: deposit.id },
      data: {
        status: 'EXPIRED',
        metadata: {
          ...metadata,
          expiredBy: 'reconciliation',
          expiredAt: new Date().toISOString()
        } as Prisma.InputJsonObject
      }
    });
    expired.push(deposit.id);
  }

  return { expired: expired.length, skipped: skipped.length, expiredIds: expired };
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

  return {
    expired,
    suspicious: suspicious.map((intent) => intent.id),
    vaultShareRetries: await retryUndeliveredVaultShares(limit),
    staleDeposits: await expireStalePlatformDeposits()
  };
}
