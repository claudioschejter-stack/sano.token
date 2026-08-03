import { prisma } from '@sanova/database';
import { ethers } from 'ethers';
import { getLinkedWalletForUser } from '../investor/linkedWalletPolicy';
import { verifyCartUsdcPayment } from './cartCheckoutService';
import { findPendingUsdcCartPurchase } from './privyInboundUsdcService';
import { baseRpcUrls, getStablecoinNetwork } from './stablecoinNetworks';

const USDC_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const DEFAULT_LOOKBACK_BLOCKS = 20_000;
const RPC_CHUNK = 9_500;

export type TreasuryPaymentCandidate = {
  txHash: string;
  blockNumber: number;
  amountUsdc: number;
};

/**
 * Confirm an already-broadcast treasury USDC payment for a cart batch.
 * Used when the Privy transfer landed on-chain but the settle response was lost
 * (timeout / deploy), which previously left the investor debited with no tokens.
 */
export async function reconcileCartBatchWithTxHash(input: {
  userId: string;
  batchId: string;
  txHash: string;
}) {
  const payer = await getLinkedWalletForUser(input.userId);
  return verifyCartUsdcPayment({
    userId: input.userId,
    batchId: input.batchId,
    txHash: input.txHash,
    expectedPayer: payer,
    settleViaTreasury: true
  });
}

/** Treasury-bound USDC transfers sent by this investor's linked wallet. */
export async function findTreasuryPaymentsFromWallet(input: {
  payerAddress: string;
  lookbackBlocks?: number;
}): Promise<TreasuryPaymentCandidate[]> {
  const network = getStablecoinNetwork('BASE');
  if (!network.tokenAddress || !network.treasuryAddress) {
    throw new Error('USDC_PAYMENT_NOT_CONFIGURED');
  }

  const payer = ethers.getAddress(input.payerAddress);
  const treasury = ethers.getAddress(network.treasuryAddress);
  const lookback = input.lookbackBlocks ?? DEFAULT_LOOKBACK_BLOCKS;
  const decimals = network.decimals ?? 6;

  let lastError: unknown = null;
  for (const url of baseRpcUrls()) {
    const provider = new ethers.JsonRpcProvider(url, 8453, { staticNetwork: true });
    try {
      const latest = await provider.getBlockNumber();
      const found: TreasuryPaymentCandidate[] = [];

      // Public Base RPC caps eth_getLogs at 10k blocks per call.
      for (let end = latest; end > latest - lookback; end -= RPC_CHUNK) {
        const start = Math.max(0, end - RPC_CHUNK + 1);
        const logs = await provider.getLogs({
          address: network.tokenAddress,
          topics: [
            USDC_TRANSFER_TOPIC,
            ethers.zeroPadValue(payer, 32),
            ethers.zeroPadValue(treasury, 32)
          ],
          fromBlock: start,
          toBlock: end
        });
        for (const log of logs) {
          found.push({
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            amountUsdc: Number(ethers.formatUnits(BigInt(log.data), decimals))
          });
        }
      }

      provider.destroy();
      return found.sort((a, b) => b.blockNumber - a.blockNumber);
    } catch (error) {
      provider.destroy();
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('BASE_RPC_UNAVAILABLE');
}

export type AutoReconcileResult = {
  userId: string;
  batchId: string | null;
  expectedUsd: number | null;
  matchedTxHash: string | null;
  status: 'CONFIRMED' | 'NO_PENDING_BATCH' | 'NO_MATCHING_PAYMENT' | 'FAILED';
  error?: string;
  candidates?: TreasuryPaymentCandidate[];
};

/**
 * Find a treasury payment that covers the investor's open cart and confirm it.
 * Only matches transfers not already used by a confirmed intent.
 */
export async function autoReconcileTreasuryPaymentForUser(
  userId: string
): Promise<AutoReconcileResult> {
  const pending = await findPendingUsdcCartPurchase(userId);
  if (!pending) {
    return {
      userId,
      batchId: null,
      expectedUsd: null,
      matchedTxHash: null,
      status: 'NO_PENDING_BATCH'
    };
  }

  const payer = await getLinkedWalletForUser(userId);
  if (!payer) {
    return {
      userId,
      batchId: pending.batchId,
      expectedUsd: pending.amountUsd,
      matchedTxHash: null,
      status: 'FAILED',
      error: 'WALLET_REQUIRED'
    };
  }

  const candidates = await findTreasuryPaymentsFromWallet({ payerAddress: payer });
  const usedHashes = new Set(
    (
      await prisma.paymentIntent.findMany({
        where: { userId, txHash: { not: null } },
        select: { txHash: true }
      })
    )
      .map((row) => row.txHash?.toLowerCase())
      .filter((hash): hash is string => Boolean(hash))
  );

  const match = candidates.find(
    (row) =>
      !usedHashes.has(row.txHash.toLowerCase()) && row.amountUsdc + 1e-9 >= pending.amountUsd
  );

  if (!match) {
    return {
      userId,
      batchId: pending.batchId,
      expectedUsd: pending.amountUsd,
      matchedTxHash: null,
      status: 'NO_MATCHING_PAYMENT',
      candidates
    };
  }

  try {
    await reconcileCartBatchWithTxHash({
      userId,
      batchId: pending.batchId,
      txHash: match.txHash
    });
    return {
      userId,
      batchId: pending.batchId,
      expectedUsd: pending.amountUsd,
      matchedTxHash: match.txHash,
      status: 'CONFIRMED'
    };
  } catch (error) {
    return {
      userId,
      batchId: pending.batchId,
      expectedUsd: pending.amountUsd,
      matchedTxHash: match.txHash,
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'RECONCILE_FAILED'
    };
  }
}
