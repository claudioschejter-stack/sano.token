import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateCheckout = vi.fn();
const mockFindPending = vi.fn();
const mockGetLinked = vi.fn();
const mockReadBalance = vi.fn();
const mockResolveWallet = vi.fn();
const mockPrepareTreasury = vi.fn();
const mockTransfer = vi.fn();
const mockWaitTransfer = vi.fn();
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

vi.mock('../privy/resolveInvestorPrivyWalletId', () => ({
  resolveInvestorPrivyWalletIdForUser: (...args: unknown[]) => mockResolveWallet(...args)
}));

vi.mock('../privy/walletTransferApi', () => ({
  privyTransferUsdc: (...args: unknown[]) => mockTransfer(...args),
  privyWaitForTransferTxHash: (...args: unknown[]) => mockWaitTransfer(...args)
}));

vi.mock('./baseUserPaysGasQuote', () => ({
  quoteBaseUserPaysGasUsd: vi.fn(async () => ({
    networkFeeUsd: 0.012345,
    networkFeeUsdRaw: 0.01,
    bufferBps: 1500,
    gasUnits: 65000,
    ethUsd: 3000,
    feeWei: 1n,
    txCount: 1,
    quotedAt: '2026-08-03T00:00:00.000Z'
  }))
}));

vi.mock('./stablecoinNetworks', () => ({
  getStablecoinNetwork: () => ({
    id: 'BASE',
    treasuryAddress: '0xTreasury000000000000000000000000000001',
    tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    chainId: 8453,
    decimals: 6
  })
}));

import { classifyPrivySendError, paySanovaCartForUser } from './paySanovaCartService';

describe('classifyPrivySendError', () => {
  it('maps Privy 401 authorization key failures to a stable code', () => {
    expect(
      classifyPrivySendError(
        'PRIVY_SEND_TRANSACTION_FAILED:401:{"error":"No valid authorization keys or user signing keys available"}'
      )
    ).toBe('PRIVY_AUTHORIZATION_SIGNER_REQUIRED');
    expect(
      classifyPrivySendError(
        'PRIVY_TRANSFER_FAILED:401:{"error":"No valid authorization keys or user signing keys available"}'
      )
    ).toBe('PRIVY_AUTHORIZATION_SIGNER_REQUIRED');
  });
});

describe('paySanovaCartForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PRIVY_APP_SECRET = 'secret';
    mockIsAuth.mockReturnValue(true);
    mockGetLinked.mockResolvedValue('0x840aed84455c3a30ef23a34a4d961bc3e1d06b41');
    mockReadBalance.mockResolvedValue({ ok: true, amountUsdc: 50, balances: [] });
    mockFindPending.mockResolvedValue(null);
    mockPrepareTreasury.mockResolvedValue({
      chainId: 8453,
      transactions: [{ to: '0xusdc', data: '0xabc', value: '0' }]
    });
  });

  it('fails hard when there is no pending purchase and no cart items', async () => {
    const result = await paySanovaCartForUser({
      userId: 'user-1',
      items: [],
      clientBalanceUsdc: 50
    });

    expect(mockCreateCheckout).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      status: 'failed',
      error: 'NO_PENDING_PURCHASE',
      balanceUsdc: 50
    });
  });

  it('retries checkout once after a Prisma interactive transaction timeout', async () => {
    mockCreateCheckout
      .mockRejectedValueOnce(
        new Error(
          'Transaction API error: Transaction already closed: The timeout for this transaction was 5000 ms'
        )
      )
      .mockResolvedValueOnce({
        batchId: 'cart-retry',
        totalUsd: '20',
        manualReview: false,
        paymentIntents: [{ id: 'pi-retry' }]
      });
    mockResolveWallet.mockResolvedValue({
      address: '0x840aed84455c3a30ef23a34a4d961bc3e1d06b41',
      walletId: 'w-1'
    });
    mockFindMany.mockResolvedValue([
      {
        id: 'pi-retry',
        amountUsd: { toNumber: () => 20 },
        metadata: { purchaseMode: 'ERC4626_DEPOSIT', vaultAddress: '0xVault', cartBatchId: 'cart-retry' }
      }
    ]);
    mockTransfer.mockResolvedValue({ actionId: 'a-1', status: 'pending', txHash: '0xhash' });
    mockVerify.mockResolvedValue([]);

    const result = await paySanovaCartForUser({
      userId: 'user-1',
      items: [{ projectId: 'proj-1', tokenCount: 1 }],
      clientBalanceUsdc: 50
    });

    expect(mockCreateCheckout).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ ok: true, status: 'settled', batchId: 'cart-retry' });
  });

  it('creates checkout then settles via Transfer API when no pending purchase exists', async () => {
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
    mockTransfer.mockResolvedValue({ actionId: 'a-1', status: 'pending', txHash: '0xhash' });
    mockVerify.mockResolvedValue([]);

    const result = await paySanovaCartForUser({
      userId: 'user-1',
      items: [{ projectId: 'proj-1', tokenCount: 1 }],
      clientBalanceUsdc: 50
    });

    expect(mockCreateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        items: [{ projectId: 'proj-1', tokenCount: 1 }],
        method: 'USDC_ONCHAIN',
        stablecoinNetwork: 'BASE',
        walletAddress: '0x840aed84455c3a30ef23a34a4d961bc3e1d06b41',
        skipGateway: true
      })
    );
    expect(result).toMatchObject({
      ok: true,
      status: 'settled',
      batchId: 'cart-new',
      txHash: '0xhash'
    });
    expect(mockTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: 'w-1',
        amountUsdc: 20,
        destinationAddress: '0xTreasury000000000000000000000000000001',
        chain: 'base'
      })
    );
    expect(mockVerify).toHaveBeenCalledWith(
      expect.objectContaining({
        settleViaTreasury: true,
        txHash: '0xhash'
      })
    );
  });

  it('requires investment plus live User-pays gas before settling', async () => {
    mockFindPending.mockResolvedValue({
      batchId: 'cart-gas',
      amountUsd: 20,
      intentIds: ['pi-gas']
    });
    mockResolveWallet.mockResolvedValue({
      address: '0x840aed84455c3a30ef23a34a4d961bc3e1d06b41',
      walletId: 'w-1'
    });
    mockFindMany.mockResolvedValue([
      {
        id: 'pi-gas',
        amountUsd: { toNumber: () => 20 },
        metadata: { purchaseMode: 'TREASURY_TRANSFER', cartBatchId: 'cart-gas' }
      }
    ]);
    mockReadBalance.mockResolvedValue({ ok: true, amountUsdc: 20, balances: [] });

    const result = await paySanovaCartForUser({
      userId: 'user-1',
      items: [],
      clientBalanceUsdc: 20
    });

    expect(mockTransfer).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      status: 'waiting_funds',
      amountUsd: 20.012345,
      networkFeeUsd: 0.012345,
      payableUsdc: 20.012345
    });
  });

  it('settles ERC-4626 carts via treasury Transfer API (not vault RPC deposit)', async () => {
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
    mockTransfer.mockResolvedValue({ actionId: 'a-2', status: 'pending', txHash: null });
    mockWaitTransfer.mockResolvedValue('0xtransferhash');
    mockVerify.mockResolvedValue([]);

    const result = await paySanovaCartForUser({
      userId: 'user-1',
      items: [],
      clientBalanceUsdc: 50
    });

    expect(mockPrepareTreasury).toHaveBeenCalled();
    expect(mockWaitTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ walletId: 'w-1', actionId: 'a-2' })
    );
    expect(result).toMatchObject({ ok: true, status: 'settled', txHash: '0xtransferhash' });
    expect(mockVerify).toHaveBeenCalledWith(
      expect.objectContaining({ settleViaTreasury: true, txHash: '0xtransferhash' })
    );
  });
});
