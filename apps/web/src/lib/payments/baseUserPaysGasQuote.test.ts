import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

import { fetchEthUsdPrice, quoteBaseUserPaysGasUsd } from './baseUserPaysGasQuote';

describe('baseUserPaysGasQuote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ETH_USD_PRICE;
    delete process.env.BASE_ETH_USD_PRICE;
    delete process.env.PRIVY_USER_PAYS_GAS_BUFFER_BPS;
    process.env.PRIVY_USER_PAYS_GAS_BUFFER_BPS = '0';
  });

  it('uses ETH_USD_PRICE env override', async () => {
    process.env.ETH_USD_PRICE = '2500';
    await expect(fetchEthUsdPrice()).resolves.toBe(2500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('quotes network fee from estimateGas + gasPrice', async () => {
    process.env.ETH_USD_PRICE = '3000';
    process.env.PRIVY_USER_PAYS_GAS_BUFFER_BPS = '0';

    fetchMock.mockImplementation(async (_url: string, init?: { body?: string }) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { method?: string };
      if (body.method === 'eth_estimateGas') {
        return {
          ok: true,
          json: async () => ({ result: '0x5208' }) // 21000
        };
      }
      if (body.method === 'eth_gasPrice') {
        return {
          ok: true,
          // 0.1 gwei
          json: async () => ({ result: '0x5f5e100' })
        };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    });

    const quote = await quoteBaseUserPaysGasUsd({
      fromAddress: '0x840aed84455C3a30Ef23a34a4D961BC3e1D06B41',
      transactions: [
        {
          to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          data: '0xa9059cbb',
          value: '0'
        }
      ]
    });

    expect(quote.txCount).toBe(1);
    expect(quote.gasUnits).toBeGreaterThan(21000);
    expect(quote.networkFeeUsd).toBeGreaterThan(0);
    expect(quote.ethUsd).toBe(3000);
  });
});
