import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBalanceOf = vi.fn();
const mockDestroy = vi.fn();

vi.mock('ethers', () => {
  class MockContract {
    balanceOf = mockBalanceOf;
  }
  class MockJsonRpcProvider {
    destroy = mockDestroy;
  }
  return {
    ethers: {
      Contract: MockContract,
      JsonRpcProvider: MockJsonRpcProvider,
      formatUnits: (value: bigint, decimals: number) => {
        const n = Number(value) / 10 ** decimals;
        return String(n);
      },
      getAddress: (value: string) => value
    }
  };
});

vi.mock('../payments/stablecoinNetworks', () => ({
  getStablecoinNetwork: () => ({
    id: 'BASE',
    kind: 'EVM',
    rpcUrl: 'https://mainnet.base.org',
    tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    chainId: 8453,
    symbol: 'USDC'
  })
}));

describe('readWalletUsdcBalanceDetailed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok with zero balance without treating empty as failure', async () => {
    mockBalanceOf.mockResolvedValue(0n);
    const { readWalletUsdcBalanceDetailed } = await import('./onChainUsdcReader');
    const result = await readWalletUsdcBalanceDetailed('0x840aed84455c3a30ef23a34a4d961bc3e1d06b41');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.amountUsdc).toBe(0);
      expect(result.balances).toHaveLength(1);
    }
  });

  it('returns ok:false on RPC failure so callers do not show 0 USDC', async () => {
    mockBalanceOf.mockRejectedValue(new Error('rate limited'));
    const { readWalletUsdcBalanceDetailed } = await import('./onChainUsdcReader');
    const result = await readWalletUsdcBalanceDetailed('0x840aed84455c3a30ef23a34a4d961bc3e1d06b41');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.amountUsdc).toBeNull();
      expect(result.balances).toEqual([]);
    }
  });

  it('returns the USDC amount on success', async () => {
    mockBalanceOf.mockResolvedValue(20_000_000n);
    const { readWalletUsdcBalanceDetailed } = await import('./onChainUsdcReader');
    const result = await readWalletUsdcBalanceDetailed('0x840aed84455c3a30ef23a34a4d961bc3e1d06b41');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.amountUsdc).toBe(20);
    }
  });
});
