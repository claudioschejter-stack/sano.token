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
    expect(items[0]?.title).toContain('wallet Sanova');
  });
});
