import { prisma, type Prisma } from '@sanova/database';
import { ethers } from 'ethers';

export type TokenMovementKindName =
  | 'USDC_PAYMENT'
  | 'USDC_GAS_FEE'
  | 'USDC_REFUND'
  | 'USDC_RENT_PAYOUT'
  | 'USDC_YIELD_PAYOUT'
  | 'USDC_TREASURY_TRANSFER'
  | 'USDC_INVESTOR_WITHDRAWAL'
  | 'RWA_SHARE_MINT'
  | 'RWA_SHARE_BURN'
  | 'RWA_SHARE_TRANSFER'
  | 'RWA_SHARE_DELIVERY'
  | 'MORPHO_SUPPLY'
  | 'MORPHO_WITHDRAW'
  | 'MORPHO_BORROW'
  | 'MORPHO_REPAY'
  | 'MORPHO_COLLATERAL_IN'
  | 'MORPHO_COLLATERAL_OUT'
  | 'MORPHO_LIQUIDATION';

export type RecordMovementInput = {
  kind: TokenMovementKindName;
  /**
   * The caller knows what this movement was, rather than inferring it from the
   * addresses involved. A refund and a rent payout are both treasury to
   * investor, so whoever guesses must never overwrite whoever knows — and the
   * transfer indexer can run before the refund is recorded.
   */
  authoritative?: boolean;
  asset: 'USDC' | 'RWA_SHARE';
  contractAddress: string;
  chainId?: number;
  fromAddress: string;
  toAddress: string;
  amountRaw: string;
  decimals: number;
  txHash: string;
  logIndex: number;
  blockNumber: number;
  occurredAt?: Date | null;
  projectId?: string | null;
  userId?: string | null;
  investorId?: string | null;
  paymentIntentId?: string | null;
  metadata?: Record<string, unknown>;
};

function normalize(address: string): string {
  try {
    return ethers.getAddress(address).toLowerCase();
  } catch {
    return address.trim().toLowerCase();
  }
}

/**
 * Append a movement to the persisted bitácora.
 * Idempotent on `(txHash, logIndex)` so re-indexing never duplicates history.
 */
export async function recordTokenMovement(input: RecordMovementInput) {
  const amount = ethers.formatUnits(BigInt(input.amountRaw), input.decimals);

  return prisma.tokenMovement.upsert({
    where: { txHash_logIndex: { txHash: input.txHash, logIndex: input.logIndex } },
    create: {
      kind: input.kind,
      asset: input.asset,
      contractAddress: normalize(input.contractAddress),
      chainId: input.chainId ?? 8453,
      fromAddress: normalize(input.fromAddress),
      toAddress: normalize(input.toAddress),
      amountRaw: input.amountRaw,
      amount,
      txHash: input.txHash,
      logIndex: input.logIndex,
      blockNumber: input.blockNumber,
      occurredAt: input.occurredAt ?? null,
      projectId: input.projectId ?? null,
      userId: input.userId ?? null,
      investorId: input.investorId ?? null,
      paymentIntentId: input.paymentIntentId ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonObject
    },
    update: {
      // Later passes can attach ownership once the payment is linked.
      projectId: input.projectId ?? undefined,
      userId: input.userId ?? undefined,
      investorId: input.investorId ?? undefined,
      paymentIntentId: input.paymentIntentId ?? undefined,
      // Only a caller that knows the intent may correct an inferred kind.
      kind: input.authoritative ? input.kind : undefined,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonObject
    }
  });
}

export async function listTokenMovements(input: {
  userId?: string | null;
  projectId?: string | null;
  address?: string | null;
  limit?: number;
}) {
  const address = input.address ? normalize(input.address) : null;

  return prisma.tokenMovement.findMany({
    where: {
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(address
        ? { OR: [{ fromAddress: address }, { toAddress: address }] }
        : {})
    },
    orderBy: [{ blockNumber: 'desc' }, { logIndex: 'desc' }],
    take: input.limit ?? 200
  });
}
