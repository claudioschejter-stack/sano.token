import type { Prisma } from '@sanova/database';
import type { PaymentMethod } from '@sanova/database';
import { paymentGatewayConfigured } from './paymentConfig';
import type { StablecoinNetwork } from './stablecoinNetworks';
import { supplyReservedMetadata } from './paymentSupplyReservation';

export type PurchaseMode = 'ERC4626_DEPOSIT' | 'TREASURY_TRANSFER';

export function resolvePurchaseMode(input: {
  method: PaymentMethod;
  vaultAddress?: string | null;
}): PurchaseMode {
  if (input.method === 'USDC_ONCHAIN' && input.vaultAddress?.trim()) {
    return 'ERC4626_DEPOSIT';
  }
  return 'TREASURY_TRANSFER';
}

type BuildPurchaseIntentMetadataInput = {
  method: PaymentMethod;
  tokenCount: number;
  project: {
    title?: string;
    pricePerToken: { toString(): string };
    vaultAddress?: string | null;
    contractAddress?: string | null;
  };
  network: StablecoinNetwork;
  payerWallet: string | null;
  payToAddress: string | null;
  risk: Record<string, unknown>;
  paymentOptionId?: string | null;
  providerRail?: string | null;
  paymentLabel?: string | null;
  cartBatchId?: string;
  cartLineIndex?: number;
  batchTotalUsdcBaseUnits?: string;
};

export function buildPurchaseIntentMetadata(input: BuildPurchaseIntentMetadataInput): Prisma.InputJsonObject {
  const purchaseMode = resolvePurchaseMode({
    method: input.method,
    vaultAddress: input.project.vaultAddress
  });

  return {
    ...supplyReservedMetadata(input.tokenCount),
    pricePerTokenUsd: input.project.pricePerToken.toString(),
    configured: paymentGatewayConfigured(input.method),
    risk: input.risk as Prisma.InputJsonValue,
    stablecoinNetwork: input.network.id,
    stablecoinNetworkLabel: input.network.label,
    stablecoinNetworkKind: input.network.kind,
    cheapestRecommendedMethod: 'USDC_ONCHAIN_BASE',
    usdcTokenAddress:
      input.method === 'USDC_ONCHAIN' || input.method === 'CUSTODIAL_STABLECOIN' ? input.network.tokenAddress : null,
    usdcDecimals:
      input.method === 'USDC_ONCHAIN' || input.method === 'CUSTODIAL_STABLECOIN' ? input.network.decimals : null,
    treasuryAddress:
      input.method === 'USDC_ONCHAIN' || input.method === 'CUSTODIAL_STABLECOIN' ? input.network.treasuryAddress : null,
    vaultAddress: input.project.vaultAddress ?? null,
    underlyingTokenAddress: input.project.contractAddress ?? null,
    shareReceiverWallet: input.payerWallet,
    expectedAssetAmountWei: String(BigInt(input.tokenCount) * 10n ** 18n),
    purchaseMode,
    autoTransferSupported: input.network.kind === 'EVM',
    paymentOptionId: input.paymentOptionId ?? null,
    providerRail: input.providerRail ?? null,
    paymentLabel: input.paymentLabel ?? null,
    ...(input.cartBatchId ? { cartBatchId: input.cartBatchId } : {}),
    ...(input.cartLineIndex != null ? { cartLineIndex: input.cartLineIndex } : {}),
    ...(input.project.title ? { projectTitle: input.project.title } : {}),
    ...(input.batchTotalUsdcBaseUnits ? { batchTotalUsdcBaseUnits: input.batchTotalUsdcBaseUnits } : {})
  };
}
