import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockIsAuthConfigured = vi.fn(() => false);
const mockGetLinkedWallet = vi.fn();
const mockReadBalance = vi.fn();
const mockFindPending = vi.fn();
const mockResolveWalletId = vi.fn();

vi.mock('@sanova/database', () => ({
  prisma: {
    paymentIntent: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([])
    }
  }
}));

vi.mock('../privy/privyAuthorizationSignature', () => ({
  isPrivyAuthorizationSigningConfigured: () => mockIsAuthConfigured()
}));

vi.mock('../investor/linkedWalletPolicy', () => ({
  getLinkedWalletForUser: (...args: unknown[]) => mockGetLinkedWallet(...args)
}));

vi.mock('../portfolio/onChainUsdcReader', () => ({
  readWalletUsdcBalances: vi.fn(),
  readWalletUsdcBalanceDetailed: (...args: unknown[]) => mockReadBalance(...args)
}));

vi.mock('./privyInboundUsdcService', () => ({
  findPendingUsdcCartPurchase: (...args: unknown[]) => mockFindPending(...args)
}));

vi.mock('../web3/usdcTreasuryTransfer', () => ({
  prepareUsdcTreasuryPayment: vi.fn()
}));

vi.mock('../privy/resolveInvestorPrivyWalletId', () => ({
  resolveInvestorPrivyWalletIdForUser: (...args: unknown[]) => mockResolveWalletId(...args)
}));

vi.mock('../privy/walletRpcApi', () => ({
  privySendTransaction: vi.fn()
}));

vi.mock('./cartCheckoutService', () => ({
  verifyCartUsdcPayment: vi.fn()
}));

import { autoSettlePrivyCartForUser, isPrivyServerAutoSettleConfigured } from './privyAutoSettleService';

describe('privyAutoSettleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PRIVY_APP_SECRET;
    mockIsAuthConfigured.mockReturnValue(false);
  });

  it('reports not configured without authorization key + app secret', async () => {
    expect(isPrivyServerAutoSettleConfigured()).toBe(false);
    const result = await autoSettlePrivyCartForUser('user-1');
    expect(result).toEqual({
      ok: false,
      status: 'not_configured',
      error: 'PRIVY_SERVER_AUTO_SETTLE_NOT_CONFIGURED'
    });
  });

  it('uses clientBalanceUsdc when server RPC balance read fails', async () => {
    process.env.PRIVY_APP_SECRET = 'secret';
    mockIsAuthConfigured.mockReturnValue(true);
    mockGetLinkedWallet.mockResolvedValue('0x840aed84455c3a30ef23a34a4d961bc3e1d06b41');
    mockReadBalance.mockResolvedValue({
      ok: false,
      amountUsdc: null,
      balances: [],
      error: 'RPC_BALANCE_READ_FAILED'
    });
    mockFindPending.mockResolvedValue({
      batchId: 'cart-1',
      amountUsd: 20,
      intentIds: ['pi-1']
    });
    mockResolveWalletId.mockResolvedValue(null);

    const result = await autoSettlePrivyCartForUser('user-1', { clientBalanceUsdc: 20 });
    expect(result).toEqual({
      ok: false,
      status: 'failed',
      error: 'PRIVY_WALLET_ID_NOT_FOUND'
    });
  });

  it('returns waiting_funds when client balance is insufficient after RPC failure', async () => {
    process.env.PRIVY_APP_SECRET = 'secret';
    mockIsAuthConfigured.mockReturnValue(true);
    mockGetLinkedWallet.mockResolvedValue('0x840aed84455c3a30ef23a34a4d961bc3e1d06b41');
    mockReadBalance.mockResolvedValue({
      ok: false,
      amountUsdc: null,
      balances: [],
      error: 'RPC_BALANCE_READ_FAILED'
    });
    mockFindPending.mockResolvedValue({
      batchId: 'cart-1',
      amountUsd: 20,
      intentIds: ['pi-1']
    });

    const result = await autoSettlePrivyCartForUser('user-1', { clientBalanceUsdc: 5 });
    expect(result).toEqual({
      ok: true,
      status: 'waiting_funds',
      address: '0x840aed84455c3a30ef23a34a4d961bc3e1d06b41',
      balanceUsdc: 5,
      amountUsd: 20
    });
    expect(mockResolveWalletId).not.toHaveBeenCalled();
  });
});
