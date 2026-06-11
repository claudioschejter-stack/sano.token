import { prisma, Prisma } from '@sanova/database';
import { getAdminAsset } from '../admin/assetsService';
import { migrateTreasuryVaultSharesToWallet } from './migrateTreasuryVaultShares';

const SHARE_DECIMALS = 18;

export function vaultSharesForTokenCount(tokenCount: number): bigint {
  if (!Number.isInteger(tokenCount) || tokenCount <= 0) {
    return 0n;
  }
  return BigInt(tokenCount) * 10n ** BigInt(SHARE_DECIMALS);
}

/** Transfer ERC-4626 vault shares from treasury to investor wallet after payment confirm. */
export async function deliverVaultSharesForPaymentIntent(paymentIntentId: string) {
  const intent = await prisma.paymentIntent.findUnique({ where: { id: paymentIntentId } });
  if (!intent || intent.status !== 'CONFIRMED') {
    return { status: 'SKIPPED' as const, reason: 'INTENT_NOT_CONFIRMED' };
  }

  const metadata = (intent.metadata as Record<string, unknown>) ?? {};
  if (metadata.purchaseMode !== 'ERC4626_DEPOSIT') {
    return { status: 'SKIPPED' as const, reason: 'NOT_VAULT_PURCHASE' };
  }

  if (typeof metadata.vaultShareDeliveryTxHash === 'string' && metadata.vaultShareDeliveryTxHash.trim()) {
    return { status: 'ALREADY_DELIVERED' as const, txHash: metadata.vaultShareDeliveryTxHash };
  }

  const recipient =
    (typeof metadata.shareReceiverWallet === 'string' ? metadata.shareReceiverWallet.trim() : '') ||
    intent.payerWalletAddress?.trim() ||
    '';

  if (!recipient) {
    return { status: 'SKIPPED' as const, reason: 'RECIPIENT_WALLET_MISSING' };
  }

  const asset = await getAdminAsset(intent.projectId);
  if (!asset?.vaultAddress) {
    return { status: 'SKIPPED' as const, reason: 'VAULT_NOT_CONFIGURED' };
  }

  const shareAmount = vaultSharesForTokenCount(intent.tokenCount);
  if (shareAmount <= 0n) {
    return { status: 'SKIPPED' as const, reason: 'INVALID_TOKEN_COUNT' };
  }

  const delivery = await migrateTreasuryVaultSharesToWallet({
    asset,
    recipientWallet: recipient,
    shareAmount
  });

  const nextMetadata = delivery.ok
    ? {
        ...metadata,
        vaultShareDeliveryStatus: 'DELIVERED',
        vaultShareDeliveryTxHash: delivery.txHash,
        vaultShareDeliveryDetail: delivery.sharesTransferred,
        vaultShareDeliveryAt: new Date().toISOString()
      }
    : {
        ...metadata,
        vaultShareDeliveryStatus: delivery.code,
        vaultShareDeliveryTxHash: null,
        vaultShareDeliveryDetail: delivery.detail ?? delivery.code,
        vaultShareDeliveryAt: new Date().toISOString()
      };

  await prisma.paymentIntent.update({
    where: { id: paymentIntentId },
    data: {
      metadata: nextMetadata as Prisma.InputJsonObject
    }
  });

  if (!delivery.ok) {
    return { status: 'FAILED' as const, code: delivery.code, detail: delivery.detail };
  }

  return { status: 'DELIVERED' as const, txHash: delivery.txHash, shares: delivery.sharesTransferred };
}
