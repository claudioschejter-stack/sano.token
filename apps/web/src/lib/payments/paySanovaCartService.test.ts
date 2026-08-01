import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateCheckout = vi.fn();
const mockFindPending = vi.fn();
const mockGetLinked = vi.fn();
const mockReadBalance = vi.fn();
const mockResolveWallet = vi.fn();
const mockPrepareTreasury = vi.fn();
const mockPrepareVault = vi.fn();
const mockSendTx = vi.fn();
const mockVerify = vi.fn();
const mockFindMany = vi.fn();
const mockIsAuth = vi.fn(() => true);

vi.mock('@sanova/database', () => ({
  prisma: {
    paymentIntent: {
      findMany: (...args: unknown[]) => mockFindMany(...args)
    }
  }
}));

vi.mock('../privy/privyAuthorizationSignature', () => ({
  isPrivyAuthorizationSigningConfigured: () => mockIsAuth()
}));

vi.mock('../investor/linkedWalletPolicy', () => ({
  getLinkedWalletForUser: (...args: unknown[]) => mockGetLinked(...args)
}));

vi.mock('../portfolio/onChainUsdcReader', () => ({
  readWalletUsdcBalanceDetailed: (...args: unknown[]) => mockReadBalance(...args)
}));

vi.mock('./privyInboundUsdcService', () => ({
  findPendingUsdcCartPurchase: (...args: unknown[]) => mockFindPending(...args)
}));

vi.mock('./cartCheckoutService', () => ({
  createCartPurchaseCheckout: (...args: unknown[]) => mockCreateCheckout(...args),
  verifyCartUsdcPayment: (...args: unknown[]) => mockVerify(...args)
}));

vi.mock('../web3/usdcTreasuryTransfer', () => ({
  prepareUsdcTreasuryPayment: (...args: unknown[]) => mockPrepareTreasury(...args)
}));

vi.mock('../web3/vaultDepositPayment', () => ({
  isErc4626DirectDepositBatch: (intents: Array<{ metadata: unknown }>) =>
    intents.every((row) => {
      const meta = (row.metadata as Record<string, unknown>) ?? {};
      return meta.purchaseMode === 'ERC4626_DEPOSIT';
    }),
  prepareVaultDepositPayment: (...args: unknown[]) => mockPrepareVault(...args)
}));

vi.mock('../privy/resolveInvestorPrivyWalletId', () => ({
  resolveInvestorPrivyWalletIdForUser: (...args: unknown[]) => mockResolveWallet(...args)
}));

vi.mock('../privy/walletRpcApi', () => ({
  privySendTransaction: (...args: unknown[]) => mockSendTx(...args)
}));

import { paySanovaCartForUser } from './paySanovaCartService';

describe('paySanovaCartForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PRIVY_APP_SECRET = 'secret';
    mockIsAuth.mockReturnValue(true);
    mockGetLinked.mockResolvedValue('0x840aed84455c3a30ef23a34a4d961bc3e1d06b41');
    mockReadBalance.mockResolvedValue({ ok: true, amountUsdc: 20, balances: [] });
    mockFindPending.mockResolvedValue(null);
  });

  it('creates checkout then settles when no pending purchase exists', async () => {
    mockCreateCheckout.mockResolvedValue({
      batchId: 'cart-new',
      totalUsd: '20',
      manualReview: false,
      paymentIntents: [{ id: 'pi-1' }]
    });
    mockResolveWallet.mockResolvedValue({
      address: '0x840aed84455c3a30ef23a34a4d961bc3e1d06b41',
      walletId: 'w-1'
    });
    mockFindMany.mockResolvedValue([
      {
        id: 'pi-1',
        amountUsd: { toNumber: () => 20 },
        metadata: { purchaseMode: 'TREASURY_TRANSFER', cartBatchId: 'cart-new' }
      }
    ]);
    mockPrepareTreasury.mockResolvedValue({
      chainId: 8453,
      transactions: [{ to: '0xtreasury', data: '0xabc', value: '0' }]
    });
    mockSendTx.mockResolvedValue('0xhash');
    mockVerify.mockResolvedValue([]);

    const result = await paySanovaCartForUser({
      userId: 'user-1',
      items: [{ projectId: 'proj-1', tokenCount: 1 }],
      clientBalanceUsdc: 20
    });

    expect(mockCreateCheckout).toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      status: 'settled',
      batchId: 'cart-new',
      txHash: '0xhash'
    });
  });

  it('uses vault deposit prepare for ERC-4626 carts', async () => {
    mockFindPending.mockResolvedValue({
      batchId: 'cart-vault',
      amountUsd: 20,
      intentIds: ['pi-v']
    });
    mockResolveWallet.mockResolvedValue({
      address: '0x840aed84455c3a30ef23a34a4d961bc3e1d06b41',
      walletId: 'w-1'
    });
    mockFindMany.mockResolvedValue([
      {
        id: 'pi-v',
        amountUsd: { toNumber: () => 20 },
        metadata: {
          purchaseMode: 'ERC4626_DEPOSIT',
          vaultAddress: '0xVault0000000000000000000000000000000001',
          cartBatchId: 'cart-vault'
        }
      }
    ]);
    mockPrepareVault.mockReturnValue({
      chainId: 8453,
      transactions: [
        { to: '0xusdc', data: '0xapprove', value: '0' },
        { to: '0xVault0000000000000000000000000000000001', data: '0xdeposit', value: '0' }
      ]
    });
    mockSendTx.mockResolvedValueOnce('0xapprovehash').mockResolvedValueOnce('0xdeposithash');
    mockVerify.mockResolvedValue([]);

    const result = await paySanovaCartForUser({
      userId: 'user-1',
      items: [],
      clientBalanceUsdc: 20
    });

    expect(mockPrepareVault).toHaveBeenCalled();
    expect(mockPrepareTreasury).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, status: 'settled', txHash: '0xdeposithash' });
  });
});
