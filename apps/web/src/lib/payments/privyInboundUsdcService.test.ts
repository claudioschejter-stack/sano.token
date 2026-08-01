import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindManyIntents = vi.fn();
const mockFindFirstDeposit = vi.fn();
const mockFindFirstIntent = vi.fn();
const mockGetLinkedWallet = vi.fn();

vi.mock('@sanova/database', () => ({
  prisma: {
    paymentIntent: {
      findMany: (...args: unknown[]) => mockFindManyIntents(...args),
      findFirst: (...args: unknown[]) => mockFindFirstIntent(...args),
      update: vi.fn()
    },
    platformDeposit: {
      findFirst: (...args: unknown[]) => mockFindFirstDeposit(...args),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn()
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ investorId: 'inv-1' }),
      findMany: vi.fn().mockResolvedValue([])
    }
  },
  Prisma: {
    Decimal: class Decimal {
      constructor(public value: string) {}
      toString() {
        return this.value;
      }
    }
  }
}));

vi.mock('../investor/linkedWalletPolicy', () => ({
  getLinkedWalletForUser: (...args: unknown[]) => mockGetLinkedWallet(...args)
}));

vi.mock('../investor/sanovaReceiveWallet', () => ({
  ensureSanovaReceiveWalletForUser: vi.fn().mockResolvedValue(null)
}));

vi.mock('../portfolio/onChainUsdcReader', () => ({
  readWalletUsdcBalances: vi.fn().mockResolvedValue([{ amountUsdc: 20 }]),
  readWalletUsdcBalanceDetailed: vi.fn().mockResolvedValue({
    ok: true,
    amountUsdc: 20,
    balances: [{ amountUsdc: 20 }]
  })
}));

vi.mock('./stablecoinNetworks', () => ({
  getStablecoinNetwork: () => ({
    id: 'BASE',
    kind: 'EVM',
    rpcUrl: null,
    tokenAddress: null,
    decimals: 6,
    treasuryAddress: null
  })
}));

vi.mock('./paymentConfig', () => ({
  paymentMinimumConfirmations: () => 1,
  paymentOrderTtlMinutes: () => 30
}));

vi.mock('./platformWalletService', () => ({
  serializeDeposit: (deposit: { id: string }) => deposit
}));

describe('findPendingUsdcCartPurchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('groups open USDC intents by cartBatchId and returns the newest batch', async () => {
    mockFindManyIntents.mockResolvedValue([
      {
        id: 'pi-old-1',
        amountUsd: { toString: () => '10' },
        metadata: { cartBatchId: 'cart-user-1' },
        createdAt: new Date('2026-07-01T10:00:00Z')
      },
      {
        id: 'pi-new-1',
        amountUsd: { toString: () => '20' },
        metadata: { cartBatchId: 'cart-user-2' },
        createdAt: new Date('2026-07-31T15:00:00Z')
      },
      {
        id: 'pi-new-2',
        amountUsd: { toString: () => '5' },
        metadata: { cartBatchId: 'cart-user-2' },
        createdAt: new Date('2026-07-31T15:01:00Z')
      }
    ]);

    const { findPendingUsdcCartPurchase } = await import('./privyInboundUsdcService');
    const pending = await findPendingUsdcCartPurchase('user-1');

    expect(pending).toEqual({
      batchId: 'cart-user-2',
      amountUsd: 25,
      intentIds: ['pi-new-1', 'pi-new-2']
    });
  });

  it('returns null when there is no cart batch', async () => {
    mockFindManyIntents.mockResolvedValue([
      {
        id: 'pi-1',
        amountUsd: { toString: () => '20' },
        metadata: {},
        createdAt: new Date()
      }
    ]);

    const { findPendingUsdcCartPurchase } = await import('./privyInboundUsdcService');
    await expect(findPendingUsdcCartPurchase('user-1')).resolves.toBeNull();
  });
});

describe('scanPrivyInboundForUser readyToAutoSettle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirstDeposit.mockResolvedValue(null);
    mockFindFirstIntent.mockResolvedValue(null);
  });

  it('marks ready when on-chain Privy balance covers the pending cart', async () => {
    mockGetLinkedWallet.mockResolvedValue('0xb3116d28d070b5bab56221b2882dce663699cc76');
    mockFindManyIntents.mockResolvedValue([
      {
        id: 'pi-1',
        amountUsd: { toString: () => '20' },
        metadata: { cartBatchId: 'cart-abc' },
        createdAt: new Date()
      }
    ]);

    const { scanPrivyInboundForUser } = await import('./privyInboundUsdcService');
    const result = await scanPrivyInboundForUser('user-1');

    expect(result.address).toBe('0xb3116d28d070b5bab56221b2882dce663699cc76');
    expect(result.balanceUsdc).toBe(20);
    expect(result.balanceKnown).toBe(true);
    expect(result.pendingPurchase?.batchId).toBe('cart-abc');
    expect(result.readyToAutoSettle).toBe(true);
  });

  it('is not ready when there is no linked wallet', async () => {
    mockGetLinkedWallet.mockResolvedValue(null);
    mockFindManyIntents.mockResolvedValue([]);

    const { scanPrivyInboundForUser } = await import('./privyInboundUsdcService');
    const result = await scanPrivyInboundForUser('user-1');

    expect(result.address).toBeNull();
    expect(result.balanceKnown).toBe(true);
    expect(result.readyToAutoSettle).toBe(false);
  });

  it('does not treat RPC balance failures as zero USDC', async () => {
    const { readWalletUsdcBalanceDetailed } = await import('../portfolio/onChainUsdcReader');
    vi.mocked(readWalletUsdcBalanceDetailed).mockResolvedValueOnce({
      ok: false,
      amountUsdc: null,
      balances: [],
      error: 'rate limited'
    });
    mockGetLinkedWallet.mockResolvedValue('0x840aed84455c3a30ef23a34a4d961bc3e1d06b41');
    mockFindManyIntents.mockResolvedValue([
      {
        id: 'pi-1',
        amountUsd: { toString: () => '20' },
        metadata: { cartBatchId: 'cart-abc' },
        createdAt: new Date()
      }
    ]);

    const { scanPrivyInboundForUser } = await import('./privyInboundUsdcService');
    const result = await scanPrivyInboundForUser('user-1');

    expect(result.balanceKnown).toBe(false);
    expect(result.balanceUsdc).toBeNull();
    expect(result.readyToAutoSettle).toBe(false);
  });
});
