import { beforeEach, describe, expect, it, vi } from 'vitest';

const TREASURY = '0xa993743CFB85E8d6481Ef60bb3D397F49604A592';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const LATEST_BLOCK = 50_000_000;

type Log = { transactionHash: string; blockNumber: number; value: bigint };

let chainLogs: Log[] = [];
/** Every [fromBlock, toBlock] the code asked for. */
let ranges: Array<{ fromBlock: number; toBlock: number }> = [];

vi.mock('@sanova/database', () => ({
  prisma: {
    platformDeposit: { findMany: async () => [], findUnique: async () => null, update: async () => ({}) },
    paymentIntent: { findMany: async () => [], findUnique: async () => null, update: async () => ({}) }
  }
}));

vi.mock('./checkoutTreasurySettlement', () => ({ settleOnRampCheckout: async () => ({ ok: true }) }));
vi.mock('./checkoutReferenceResolver', () => ({
  resolveCheckoutReferenceByPartnerOrderId: async () => null,
  resolveExpectedAmountUsd: async () => 0
}));
vi.mock('./cartCheckoutService', () => ({
  confirmCartPurchaseBatch: async () => [],
  loadCartBatchIntentsAnyStatus: async () => []
}));
vi.mock('./platformWalletService', () => ({ confirmPlatformDeposit: async () => ({}) }));
vi.mock('./ripioClient', () => ({ ripioConfigured: () => false }));
vi.mock('./ripioOnRampAdapter', () => ({ createRipioOnRampCheckout: async () => ({ provider: 'ripio' }) }));
vi.mock('./paymentConfig', () => ({ paymentMinimumConfirmations: () => 1 }));
vi.mock('./stablecoinNetworks', () => ({
  getStablecoinNetwork: () => ({
    id: 'BASE',
    kind: 'EVM',
    decimals: 6,
    rpcUrl: 'https://rpc.test',
    tokenAddress: USDC,
    treasuryAddress: TREASURY
  })
}));

vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');
  class FakeProvider {
    async getBlockNumber() {
      return LATEST_BLOCK;
    }
    async getLogs(query: { fromBlock: number; toBlock: number }) {
      ranges.push({ fromBlock: query.fromBlock, toBlock: query.toBlock });
      return chainLogs
        .filter((log) => log.blockNumber >= query.fromBlock && log.blockNumber <= query.toBlock)
        .map((log) => ({
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          topics: [actual.id('Transfer(address,address,uint256)'), '0x', '0x'],
          data: actual.AbiCoder.defaultAbiCoder().encode(['uint256'], [log.value])
        }));
    }
    async getTransactionReceipt(hash: string) {
      const log = chainLogs.find((row) => row.transactionHash === hash);
      return log ? { status: 1, blockNumber: log.blockNumber, hash } : null;
    }
    destroy() {}
  }
  class FakeInterface {
    parseLog(log: { data: string }) {
      const [value] = actual.AbiCoder.defaultAbiCoder().decode(['uint256'], log.data);
      return { args: { value } };
    }
  }
  // The module reads `ethers.JsonRpcProvider` off the namespace export, so the
  // namespace has to be patched too, not only the named exports.
  return {
    ...actual,
    JsonRpcProvider: FakeProvider,
    Interface: FakeInterface,
    ethers: { ...actual.ethers, JsonRpcProvider: FakeProvider, Interface: FakeInterface }
  };
});

const { lookbackBlocksForWait, waitingSinceMsOf, scanTreasuryForPendingCartUsdcBatch } = await import(
  './postPaymentSettlementOrchestrator'
);

const NOW = Date.UTC(2026, 7, 9, 12, 0, 0);
const HOUR_MS = 3_600_000;

beforeEach(() => {
  chainLogs = [];
  ranges = [];
});

describe('lookbackBlocksForWait', () => {
  it('keeps the old hundred-minute floor when the wait is unknown', () => {
    expect(lookbackBlocksForWait({ waitingSinceMs: null, nowMs: NOW })).toBe(3000);
    expect(lookbackBlocksForWait({ nowMs: NOW })).toBe(3000);
  });

  it('does not shrink below the floor for a payment that just started waiting', () => {
    expect(lookbackBlocksForWait({ waitingSinceMs: NOW - 60_000, nowMs: NOW })).toBe(3000);
  });

  it('covers a full day of waiting, which the fixed window did not', () => {
    // Base makes a block every 2s: a day is 43 200 blocks, versus the old 3000.
    const blocks = lookbackBlocksForWait({ waitingSinceMs: NOW - 24 * HOUR_MS, nowMs: NOW });
    expect(blocks).toBeGreaterThan(43_200);
    expect(blocks).toBeLessThan(45_000);
  });

  it('stops at thirty days instead of scanning the whole chain', () => {
    const blocks = lookbackBlocksForWait({ waitingSinceMs: NOW - 400 * 24 * HOUR_MS, nowMs: NOW });
    expect(blocks).toBe(1_296_000);
  });

  it('ignores a timestamp in the future rather than computing a negative window', () => {
    expect(lookbackBlocksForWait({ waitingSinceMs: NOW + HOUR_MS, nowMs: NOW })).toBe(3000);
  });
});

describe('waitingSinceMsOf', () => {
  it('prefers when the conversion was queued over when the row was created', () => {
    const queuedAt = new Date(NOW - HOUR_MS).toISOString();
    expect(
      waitingSinceMsOf({
        createdAt: new Date(NOW - 10 * HOUR_MS),
        metadata: { fiatToUsdcConversionQueuedAt: queuedAt }
      })
    ).toBe(NOW - HOUR_MS);
  });

  it('falls back to createdAt for rows written before that field existed', () => {
    expect(waitingSinceMsOf({ createdAt: new Date(NOW - 5 * HOUR_MS), metadata: {} })).toBe(
      NOW - 5 * HOUR_MS
    );
  });

  it('ignores an unparseable timestamp', () => {
    expect(
      waitingSinceMsOf({
        createdAt: new Date(NOW - 5 * HOUR_MS),
        metadata: { fiatToUsdcConversionQueuedAt: 'ayer' }
      })
    ).toBe(NOW - 5 * HOUR_MS);
  });
});

describe('findMatchingTreasuryUsdcTransfer, through the cart watcher', () => {
  async function runWatcher(intent: { createdAt: Date; metadata: Record<string, unknown> }) {
    const cartService = await import('./cartCheckoutService');
    vi.spyOn(cartService, 'loadCartBatchIntentsAnyStatus').mockResolvedValue([
      {
        id: 'pi-1',
        status: 'REQUIRES_PAYMENT',
        amountUsd: { toNumber: () => 25 },
        createdAt: intent.createdAt,
        metadata: intent.metadata
      }
    ] as never);
    return scanTreasuryForPendingCartUsdcBatch('user-1', 'batch-1');
  }

  it('splits a long window into chunks under the ten-thousand block cap', async () => {
    await runWatcher({ createdAt: new Date(Date.now() - 24 * HOUR_MS), metadata: {} });

    expect(ranges.length).toBeGreaterThan(1);
    for (const range of ranges) {
      expect(range.toBlock - range.fromBlock + 1).toBeLessThanOrEqual(9000);
    }
  });

  it('asks for the newest blocks first, so a recent transfer costs one call', async () => {
    chainLogs = [
      { transactionHash: '0xrecent', blockNumber: LATEST_BLOCK - 10, value: 25_000_000n }
    ];

    const outcome = await runWatcher({
      createdAt: new Date(Date.now() - 24 * HOUR_MS),
      metadata: {}
    });

    expect(outcome.allConfirmed).toBe(true);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].toBlock).toBe(LATEST_BLOCK);
  });

  it('finds a transfer older than the old fixed hundred-minute window', async () => {
    // 20 000 blocks back is ~11 hours: outside the old 3000-block window.
    chainLogs = [
      { transactionHash: '0xold', blockNumber: LATEST_BLOCK - 20_000, value: 25_000_000n }
    ];

    const outcome = await runWatcher({
      createdAt: new Date(Date.now() - 24 * HOUR_MS),
      metadata: {}
    });

    expect(outcome.allConfirmed).toBe(true);
  });

  it('does not reach for a transfer from before the payment started waiting', async () => {
    chainLogs = [
      { transactionHash: '0xancient', blockNumber: LATEST_BLOCK - 500_000, value: 25_000_000n }
    ];

    const outcome = await runWatcher({
      createdAt: new Date(Date.now() - 2 * HOUR_MS),
      metadata: {}
    });

    expect(outcome.allConfirmed).toBe(false);
  });
});
