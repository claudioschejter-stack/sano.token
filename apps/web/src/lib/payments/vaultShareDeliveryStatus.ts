export type VaultShareDeliveryUiState = 'none' | 'delivered' | 'failed' | 'pending';

export function vaultShareDeliveryUiState(
  metadata: Record<string, unknown> | null | undefined
): VaultShareDeliveryUiState {
  if (metadata?.purchaseMode !== 'ERC4626_DEPOSIT') {
    return 'none';
  }

  if (
    metadata.vaultShareDeliveryStatus === 'DELIVERED' ||
    metadata.vaultShareDeliveryStatus === 'DELIVERED_ONCHAIN' ||
    (typeof metadata.vaultShareDeliveryTxHash === 'string' && metadata.vaultShareDeliveryTxHash.trim())
  ) {
    return 'delivered';
  }

  if (
    typeof metadata.vaultShareDeliveryStatus === 'string' &&
    metadata.vaultShareDeliveryStatus !== 'DELIVERED'
  ) {
    return 'failed';
  }

  return 'pending';
}

export async function deliverVaultSharesAfterPayment(paymentIntentId: string) {
  const { deliverVaultSharesForPaymentIntent } = await import('../blockchain/investorVaultShareDelivery');
  return deliverVaultSharesForPaymentIntent(paymentIntentId);
}
