import { vaultShareDeliveryUiState } from './vaultShareDeliveryStatus';

export type CartSettlementIntent = {
  status?: string | null;
  txHash?: string | null;
  tokenCount?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type CartSettlementSummary = {
  /** Every line confirmed on-chain (USDC reached treasury). */
  paid: boolean;
  treasuryTxHash: string | null;
  /** RWA tokens/shares are in the investor wallet. */
  tokensDelivered: boolean;
  /** Delivery still running (vault shares transfer in flight). */
  deliveryPending: boolean;
  /** Delivery attempted and failed — needs ops, investor already paid. */
  deliveryFailed: boolean;
  shareTxHashes: string[];
  tokenCount: number;
};

function normalizeHash(value: unknown): string | null {
  return typeof value === 'string' && value.trim().startsWith('0x') ? value.trim() : null;
}

/**
 * Both legs of a crypto purchase, for the checkout success state:
 * USDC confirmed to treasury **and** RWA tokens delivered to the investor.
 */
export function summarizeCartSettlement(
  intents: CartSettlementIntent[]
): CartSettlementSummary {
  if (!intents.length) {
    return {
      paid: false,
      treasuryTxHash: null,
      tokensDelivered: false,
      deliveryPending: false,
      deliveryFailed: false,
      shareTxHashes: [],
      tokenCount: 0
    };
  }

  const paid = intents.every((row) => row.status === 'CONFIRMED');
  const treasuryTxHash =
    intents.map((row) => normalizeHash(row.txHash)).find((hash) => hash) ?? null;

  const shareTxHashes: string[] = [];
  let deliveredLines = 0;
  let pendingLines = 0;
  let failedLines = 0;

  for (const intent of intents) {
    const metadata = intent.metadata ?? {};
    const state = vaultShareDeliveryUiState(metadata);

    if (state === 'none') {
      // Non-vault line: credited by the confirmed payment itself.
      if (intent.status === 'CONFIRMED') deliveredLines += 1;
      continue;
    }

    if (state === 'delivered') {
      deliveredLines += 1;
      const hash = normalizeHash(metadata.vaultShareDeliveryTxHash);
      if (hash) shareTxHashes.push(hash);
      continue;
    }

    if (state === 'failed') {
      failedLines += 1;
      continue;
    }

    pendingLines += 1;
  }

  const tokenCount = intents.reduce(
    (sum, row) => sum + (Number.isFinite(row.tokenCount) ? Number(row.tokenCount) : 0),
    0
  );

  return {
    paid,
    treasuryTxHash,
    tokensDelivered: paid && deliveredLines === intents.length,
    deliveryPending: paid && pendingLines > 0 && failedLines === 0,
    deliveryFailed: failedLines > 0,
    shareTxHashes: [...new Set(shareTxHashes)],
    tokenCount
  };
}
