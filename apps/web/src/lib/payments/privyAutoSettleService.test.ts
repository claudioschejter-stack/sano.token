import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sanova/database', () => ({
  prisma: {
    paymentIntent: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([])
    }
  }
}));

vi.mock('../privy/privyAuthorizationSignature', () => ({
  isPrivyAuthorizationSigningConfigured: () => false
}));

vi.mock('../investor/linkedWalletPolicy', () => ({
  getLinkedWalletForUser: vi.fn()
}));

vi.mock('../portfolio/onChainUsdcReader', () => ({
  readWalletUsdcBalances: vi.fn(),
  readWalletUsdcBalanceDetailed: vi.fn()
}));

vi.mock('./privyInboundUsdcService', () => ({
  findPendingUsdcCartPurchase: vi.fn()
}));

vi.mock('../web3/usdcTreasuryTransfer', () => ({
  prepareUsdcTreasuryPayment: vi.fn()
}));

vi.mock('../privy/resolveInvestorPrivyWalletId', () => ({
  resolveInvestorPrivyWalletIdForUser: vi.fn()
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
});
