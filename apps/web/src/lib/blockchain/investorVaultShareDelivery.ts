import { prisma, Prisma } from '@sanova/database';
import { getAdminAsset } from '../admin/assetsService';
import { migrateTreasuryVaultSharesToWallet } from './migrateTreasuryVaultShares';

const SHARE_DECIMALS = 18;
const DELIVERY_LOCK_MS = 2 * 60 * 1000;

export function vaultSharesForTokenCount(tokenCount: number): bigint {
  if (!Number.isInteger(tokenCount) || tokenCount <= 0) {
    return 0n;
  }
  return BigInt(tokenCount) * 10n ** BigInt(SHARE_DECIMALS);
}

function deliveryAlreadyComplete(metadata: Record<string, unknown>): boolean {
  return (
    metadata.vaultShareDeliveryStatus === 'DELIVERED' ||
    (typeof metadata.vaultShareDeliveryTxHash === 'string' && metadata.vaultShareDeliveryTxHash.trim().length > 0)
  );
}

function deliveryInProgress(metadata: Record<string, unknown>): boolean {
  if (metadata.vaultShareDeliveryStatus !== 'IN_PROGRESS') {
    return false;
  }
  const startedAt = metadata.vaultShareDeliveryStartedAt;
  if (typeof startedAt !== 'string') {
    return true;
  }
  const elapsed = Date.now() - Date.parse(startedAt);
  return Number.isFinite(elapsed) && elapsed < DELIVERY_LOCK_MS;
}

async function claimVaultShareDelivery(paymentIntentId: string): Promise<
  | { ok: true; intent: NonNullable<Awaited<ReturnType<typeof prisma.paymentIntent.findUnique>>>; metadata: Record<string, unknown> }
  | { ok: false; status: 'SKIPPED' | 'ALREADY_DELIVERED' | 'IN_PROGRESS'; reason: string }
> {
  return prisma.$transaction(async (tx) => {
    const intent = await tx.paymentIntent.findUnique({ where: { id: paymentIntentId } });
    if (!intent || intent.status !== 'CONFIRMED') {
      return { ok: false, status: 'SKIPPED', reason: 'INTENT_NOT_CONFIRMED' };
    }

    const metadata = (intent.metadata as Record<string, unknown>) ?? {};
    if (metadata.purchaseMode !== 'ERC4626_DEPOSIT') {
      return { ok: false, status: 'SKIPPED', reason: 'NOT_VAULT_PURCHASE' };
    }

    if (deliveryAlreadyComplete(metadata)) {
      return { ok: false, status: 'ALREADY_DELIVERED', reason: 'ALREADY_DELIVERED' };
    }

    if (deliveryInProgress(metadata)) {
      return { ok: false, status: 'IN_PROGRESS', reason: 'DELIVERY_IN_PROGRESS' };
    }

    const lockedMetadata = {
      ...metadata,
      vaultShareDeliveryStatus: 'IN_PROGRESS',
      vaultShareDeliveryStartedAt: new Date().toISOString()
    } as Prisma.InputJsonObject;

    const updated = await tx.paymentIntent.update({
      where: { id: paymentIntentId },
      data: { metadata: lockedMetadata }
    });

    return { ok: true, intent: updated, metadata: lockedMetadata as Record<string, unknown> };
  });
}

/** Transfer ERC-4626 vault shares from treasury to investor wallet after payment confirm. */
export async function deliverVaultSharesForPaymentIntent(paymentIntentId: string) {
  const claim = await claimVaultShareDelivery(paymentIntentId);
  if (claim.ok === false) {
    if (claim.status === 'ALREADY_DELIVERED') {
      const intent = await prisma.paymentIntent.findUnique({ where: { id: paymentIntentId } });
      const metadata = (intent?.metadata as Record<string, unknown>) ?? {};
      return {
        status: 'ALREADY_DELIVERED' as const,
        txHash: typeof metadata.vaultShareDeliveryTxHash === 'string' ? metadata.vaultShareDeliveryTxHash : undefined
      };
    }
    return { status: 'SKIPPED' as const, reason: claim.reason };
  }

  const intent = claim.intent;
  const metadata = claim.metadata;

  const recipient =
    (typeof metadata.shareReceiverWallet === 'string' ? metadata.shareReceiverWallet.trim() : '') ||
    intent.payerWalletAddress?.trim() ||
    '';

  if (!recipient) {
    await prisma.paymentIntent.update({
      where: { id: paymentIntentId },
      data: {
        metadata: {
          ...metadata,
          vaultShareDeliveryStatus: 'RECIPIENT_WALLET_MISSING',
          vaultShareDeliveryAt: new Date().toISOString()
        } as Prisma.InputJsonObject
      }
    });
    return { status: 'SKIPPED' as const, reason: 'RECIPIENT_WALLET_MISSING' };
  }

  const asset = await getAdminAsset(intent.projectId);
  if (!asset?.vaultAddress) {
    await prisma.paymentIntent.update({
      where: { id: paymentIntentId },
      data: {
        metadata: {
          ...metadata,
          vaultShareDeliveryStatus: 'VAULT_NOT_CONFIGURED',
          vaultShareDeliveryAt: new Date().toISOString()
        } as Prisma.InputJsonObject
      }
    });
    return { status: 'SKIPPED' as const, reason: 'VAULT_NOT_CONFIGURED' };
  }

  const shareAmount = vaultSharesForTokenCount(intent.tokenCount);
  if (shareAmount <= 0n) {
    await prisma.paymentIntent.update({
      where: { id: paymentIntentId },
      data: {
        metadata: {
          ...metadata,
          vaultShareDeliveryStatus: 'INVALID_TOKEN_COUNT',
          vaultShareDeliveryAt: new Date().toISOString()
        } as Prisma.InputJsonObject
      }
    });
    return { status: 'SKIPPED' as const, reason: 'INVALID_TOKEN_COUNT' };
  }

  const delivery = await migrateTreasuryVaultSharesToWallet({
    asset,
    recipientWallet: recipient,
    shareAmount
  });

  if (!delivery.ok) {
    const failureCode = 'code' in delivery ? delivery.code : 'TRANSFER_FAILED';
    const failureDetail = 'detail' in delivery ? delivery.detail : undefined;

    await prisma.paymentIntent.update({
      where: { id: paymentIntentId },
      data: {
        metadata: {
          ...metadata,
          vaultShareDeliveryStatus: failureCode,
          vaultShareDeliveryTxHash: null,
          vaultShareDeliveryDetail: failureDetail ?? failureCode,
          vaultShareDeliveryAt: new Date().toISOString()
        } as Prisma.InputJsonObject
      }
    });

    return { status: 'FAILED' as const, code: failureCode, detail: failureDetail };
  }

  await prisma.paymentIntent.update({
    where: { id: paymentIntentId },
    data: {
      metadata: {
        ...metadata,
        vaultShareDeliveryStatus: 'DELIVERED',
        vaultShareDeliveryTxHash: delivery.txHash,
        vaultShareDeliveryDetail: delivery.sharesTransferred,
        vaultShareDeliveryAt: new Date().toISOString()
      } as Prisma.InputJsonObject
    }
  });

  return { status: 'DELIVERED' as const, txHash: delivery.txHash, shares: delivery.sharesTransferred };
}
