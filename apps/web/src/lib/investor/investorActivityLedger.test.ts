import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindUser = vi.fn();
const mockFindDeposits = vi.fn();
const mockFindWithdrawals = vi.fn();
const mockFindLedger = vi.fn();
const mockFindDividends = vi.fn();
const mockFindIntents = vi.fn();

vi.mock('@sanova/database', () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockFindUser(...args) },
    platformDeposit: { findMany: (...args: unknown[]) => mockFindDeposits(...args) },
    platformWithdrawal: { findMany: (...args: unknown[]) => mockFindWithdrawals(...args) },
    platformWalletLedgerEntry: { findMany: (...args: unknown[]) => mockFindLedger(...args) },
    dividendDistribution: { findMany: (...args: unknown[]) => mockFindDividends(...args) },
    paymentIntent: { findMany: (...args: unknown[]) => mockFindIntents(...args) }
  }
}));

describe('getInvestorActivityLedger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUser.mockResolvedValue({ investorId: 'inv-1' });
    mockFindDeposits.mockResolvedValue([]);
    mockFindWithdrawals.mockResolvedValue([]);
    mockFindLedger.mockResolvedValue([]);
    mockFindDividends.mockResolvedValue([]);
    mockFindIntents.mockResolvedValue([]);
  });

  it('includes Privy inbound USDC deposits in the ledger', async () => {
    mockFindDeposits.mockResolvedValue([
      {
        id: 'dep-1',
        status: 'CONFIRMED',
        amountUsd: { toNumber: () => 20 },
        method: 'USDC_ONCHAIN',
        provider: 'privy_inbound_watch',
        payToAddress: '0x840aed84455c3a30ef23a34a4d961bc3e1d06b41',
        payerWalletAddress: '0xabc',
        txHash: '0xhash',
        confirmedAt: new Date('2026-08-01T12:00:00Z'),
        createdAt: new Date('2026-08-01T11:00:00Z'),
        metadata: { custody: 'privy_wallet' }
      }
    ]);

    const { getInvestorActivityLedger } = await import('./investorActivityLedger');
    const items = await getInvestorActivityLedger('user-1', { limit: 10 });

    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe('deposit');
    expect(items[0]?.amountUsd).toBe(20);
    expect(items[0]?.title).toBe('Depósito USDC');
    expect(items[0]?.subtitle).toBe('Wallet Sanova');
  });

  it('queries only confirmed/posted movements across every activity kind', async () => {
    const { getInvestorActivityLedger } = await import('./investorActivityLedger');
    await getInvestorActivityLedger('user-1', { limit: 10 });

    expect(mockFindDeposits).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1', status: 'CONFIRMED' })
      })
    );
    expect(mockFindWithdrawals).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1', status: 'CONFIRMED' })
      })
    );
    expect(mockFindLedger).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1', status: 'POSTED' })
      })
    );
    expect(mockFindDividends).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: ['LIQUIDATED_CASH', 'LIQUIDATED_FIAT', 'CONFIRMED', 'COMPLETED']
          }
        })
      })
    );
    expect(mockFindIntents).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          status: 'CONFIRMED'
        })
      })
    );
  });

  it('includes confirmed deposits, withdrawals, ledger, dividends and purchases together', async () => {
    mockFindDeposits.mockResolvedValue([
      {
        id: 'dep-1',
        status: 'CONFIRMED',
        amountUsd: { toNumber: () => 50 },
        method: 'USDC_ONCHAIN',
        provider: 'privy_inbound_watch',
        payToAddress: '0x840a',
        payerWalletAddress: '0xabc',
        txHash: '0xdep',
        confirmedAt: new Date('2026-08-02T10:00:00Z'),
        createdAt: new Date('2026-08-02T09:00:00Z'),
        metadata: { custody: 'privy_wallet' }
      }
    ]);
    mockFindWithdrawals.mockResolvedValue([
      {
        id: 'wd-1',
        status: 'CONFIRMED',
        amountUsd: { toNumber: () => 15 },
        method: 'STABLECOIN',
        destinationAddress: '0xdest',
        txHash: '0xwd',
        createdAt: new Date('2026-08-02T11:00:00Z'),
        confirmedAt: new Date('2026-08-02T11:05:00Z')
      }
    ]);
    mockFindLedger.mockResolvedValue([
      {
        id: 'led-1',
        type: 'CREDIT',
        amount: { toNumber: () => 5 },
        currency: 'USD',
        status: 'POSTED',
        createdAt: new Date('2026-08-02T12:00:00Z'),
        txHash: null,
        depositId: null,
        paymentIntentId: null
      }
    ]);
    mockFindDividends.mockResolvedValue([
      {
        id: 'div-1',
        amount: { toNumber: () => 3.5 },
        currency: 'USD',
        status: 'LIQUIDATED_CASH',
        distributedAt: new Date('2026-08-02T13:00:00Z'),
        txHash: '0xdiv',
        assetId: 'asset-1'
      }
    ]);
    mockFindIntents.mockResolvedValue([
      {
        id: 'pi-1',
        status: 'CONFIRMED',
        amountUsd: { toNumber: () => 20 },
        method: 'USDC_ONCHAIN',
        txHash: '0xbuy',
        createdAt: new Date('2026-08-02T14:00:00Z'),
        confirmedAt: new Date('2026-08-02T14:01:00Z'),
        metadata: { cartBatchId: 'cart-1' }
      }
    ]);

    const { getInvestorActivityLedger } = await import('./investorActivityLedger');
    const items = await getInvestorActivityLedger('user-1', { limit: 20 });
    const kinds = items.map((row) => row.kind).sort();

    expect(kinds).toEqual([
      'deposit',
      'dividend',
      'ledger_credit',
      'purchase',
      'withdrawal'
    ]);
    expect(items.every((row) => ['CONFIRMED', 'POSTED', 'LIQUIDATED_CASH'].includes(row.status))).toBe(
      true
    );
  });

  it('aggregates confirmed cart lines into one purchase outflow per batch', async () => {
    mockFindIntents.mockResolvedValue([
      {
        id: 'pi-1',
        status: 'CONFIRMED',
        amountUsd: { toNumber: () => 20 },
        method: 'USDC_ONCHAIN',
        txHash: '0xabc',
        createdAt: new Date('2026-08-02T15:00:00Z'),
        confirmedAt: new Date('2026-08-02T15:01:00Z'),
        metadata: { cartBatchId: 'cart-user-1' }
      },
      {
        id: 'pi-2',
        status: 'CONFIRMED',
        amountUsd: { toNumber: () => 10 },
        method: 'USDC_ONCHAIN',
        txHash: '0xabc',
        createdAt: new Date('2026-08-02T15:00:00Z'),
        confirmedAt: new Date('2026-08-02T15:01:00Z'),
        metadata: { cartBatchId: 'cart-user-1' }
      }
    ]);

    const { getInvestorActivityLedger } = await import('./investorActivityLedger');
    const items = await getInvestorActivityLedger('user-1', { limit: 10 });
    const purchases = items.filter((row) => row.kind === 'purchase');

    expect(purchases).toHaveLength(1);
    expect(purchases[0]?.amountUsd).toBe(-30);
    expect(purchases[0]?.id).toBe('purchase-batch:cart-user-1');
    expect(purchases[0]?.occurredAt).toBe('2026-08-02T15:01:00.000Z');
  });
});
