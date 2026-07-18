import {
  areBridgePayoutsEnabled,
  createBridgeOfframpTransfer,
  findBridgeCustomerByExternalId,
  getBridgeApiKey,
  getBridgePayoutDeveloperFee,
  getBridgeWalletCurrency,
  getBridgeWalletId,
  normalizeBridgeFiatPayoutCurrency,
  type BridgeTransfer
} from './bridgeClient';

type BridgePayoutDetails = {
  bridgeExternalAccountId?: string | null;
  bridgeCurrency?: string | null;
};

export type BridgePayoutResult =
  | { ok: true; transfer: BridgeTransfer }
  | {
      ok: false;
      reason:
        | 'BRIDGE_PAYOUT_NOT_CONFIGURED'
        | 'BRIDGE_CUSTOMER_NOT_FOUND'
        | 'BRIDGE_EXTERNAL_ACCOUNT_MISSING'
        | 'BRIDGE_PAYOUT_FAILED';
      error?: string;
    };

export function withdrawalSupportsBridgePayout(details: BridgePayoutDetails | null | undefined): boolean {
  return Boolean(details?.bridgeExternalAccountId?.trim()) && areBridgePayoutsEnabled();
}

/**
 * Create a Bridge transfer from the platform Bridge wallet to the investor's
 * linked external account. Idempotent per withdrawal id.
 */
export async function executeBridgeFiatPayout(input: {
  userId: string;
  withdrawalId: string;
  amountUsd: number;
  payoutDetails: BridgePayoutDetails;
}): Promise<BridgePayoutResult> {
  const apiKey = getBridgeApiKey();
  const walletId = getBridgeWalletId();
  if (!areBridgePayoutsEnabled() || !apiKey || !walletId) {
    return { ok: false, reason: 'BRIDGE_PAYOUT_NOT_CONFIGURED' };
  }

  const externalAccountId = input.payoutDetails.bridgeExternalAccountId?.trim();
  if (!externalAccountId) {
    return { ok: false, reason: 'BRIDGE_EXTERNAL_ACCOUNT_MISSING' };
  }

  const customer = await findBridgeCustomerByExternalId(apiKey, `sanova-${input.userId}`);
  if (!customer?.id) {
    return { ok: false, reason: 'BRIDGE_CUSTOMER_NOT_FOUND' };
  }

  const amount = Number(input.amountUsd);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: 'BRIDGE_PAYOUT_FAILED', error: 'INVALID_AMOUNT' };
  }

  try {
    const transfer = await createBridgeOfframpTransfer({
      apiKey,
      customerId: customer.id,
      amount: amount.toFixed(2),
      bridgeWalletId: walletId,
      sourceCurrency: getBridgeWalletCurrency(),
      destinationCurrency: normalizeBridgeFiatPayoutCurrency(input.payoutDetails.bridgeCurrency),
      externalAccountId,
      developerFee: getBridgePayoutDeveloperFee(),
      clientReferenceId: `wd_${input.withdrawalId}`,
      idempotencyKey: `bridge-payout:${input.withdrawalId}`
    });
    return { ok: true, transfer };
  } catch (error) {
    return {
      ok: false,
      reason: 'BRIDGE_PAYOUT_FAILED',
      error: error instanceof Error ? error.message : 'BRIDGE_PAYOUT_FAILED'
    };
  }
}
