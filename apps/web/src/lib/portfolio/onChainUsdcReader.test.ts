import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../payments/stablecoinNetworks', () => ({
  getStablecoinNetwork: () => ({
    id: 'BASE',
    kind: 'EVM',
    rpcUrl: 'https://mainnet.base.org',
    tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    chainId: 8453,
    symbol: 'USDC'
  }),
  baseRpcUrls: () => ['https://rpc-a.example', 'https://rpc-b.example']
}));

describe('readWalletUsdcBalanceDetailed', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns ok with zero balance', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: '0x0'
        })
    }) as unknown as typeof fetch;

    const { readWalletUsdcBalanceDetailed } = await import('./onChainUsdcReader');
    const result = await readWalletUsdcBalanceDetailed('0x840aed84455c3a30ef23a34a4d961bc3e1d06b41');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.amountUsdc).toBe(0);
    }
  });

  it('returns ok:false when all RPC candidates fail', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited'
    }) as unknown as typeof fetch;

    const { readWalletUsdcBalanceDetailed } = await import('./onChainUsdcReader');
    const result = await readWalletUsdcBalanceDetailed('0x840aed84455c3a30ef23a34a4d961bc3e1d06b41');
    expect(result.ok).toBe(false);
  });

  it('falls back to the next RPC when the primary fails', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'rate limited'
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'rate limited'
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: '0x1312d00'
          })
      }) as unknown as typeof fetch;

    const { readWalletUsdcBalanceDetailed } = await import('./onChainUsdcReader');
    const result = await readWalletUsdcBalanceDetailed('0x840aed84455c3a30ef23a34a4d961bc3e1d06b41');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.amountUsdc).toBe(20);
    }
  });
});
