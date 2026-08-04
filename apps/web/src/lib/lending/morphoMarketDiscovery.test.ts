import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AbiCoder, Interface } from 'ethers';

const MORPHO = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const VAULT = '0x125782B1302be9a2f58849f8A86F25F78009b367';
const OTHER_VAULT = '0x95F1359144c66C8dDFd709D7111a36CAE8bb6089';
const ORACLE = '0x81bc0d8e0207E140b3101EB8Ffd2C387bD30AAEa';
const IRM = '0x46415998764C29aB2a25CbeA6254146D50D22687';
const MARKET_A = '0x' + 'aa'.repeat(32);
const MARKET_B = '0x' + 'bb'.repeat(32);

const EVENTS = new Interface([
  'event CreateMarket(bytes32 indexed id, (address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams)'
]);

let logs: Array<{ topics: string[]; data: string }> = [];
let markets: Record<string, [bigint, bigint, bigint, bigint, bigint, bigint]> = {};
let getLogsFails = false;

vi.mock('./baseContracts', () => ({ getLendingChainConfig: () => ({ morpho: MORPHO }) }));
vi.mock('../blockchain/rpcRetry', () => ({
  readWithRetry: async (fn: () => Promise<unknown>) => {
    try {
      return await fn();
    } catch {
      return null;
    }
  }
}));

vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');
  class FakeContract {
    async market(id: string) {
      return markets[id] ?? [0n, 0n, 0n, 0n, 0n, 0n];
    }
  }
  return { ...actual, Contract: FakeContract };
});

const { discoverMarketsByCollateral } = await import('./morphoMarketDiscovery');

function createMarketLog(marketId: string, collateral: string, lltv: bigint) {
  return {
    topics: [EVENTS.getEvent('CreateMarket')!.topicHash, marketId],
    data: AbiCoder.defaultAbiCoder().encode(
      ['(address,address,address,address,uint256)'],
      [[USDC, collateral, ORACLE, IRM, lltv]]
    )
  };
}

const provider = {
  getBlockNumber: async () => 30_000_000,
  getLogs: async () => {
    if (getLogsFails) throw new Error('query returned more than 10000 results');
    return logs;
  }
} as never;

beforeEach(() => {
  getLogsFails = false;
  logs = [createMarketLog(MARKET_A, VAULT, 625_000_000_000_000_000n)];
  markets = { [MARKET_A]: [500_000_000n, 0n, 0n, 0n, 0n, 0n] };
});

describe('discoverMarketsByCollateral', () => {
  it('finds the market for a vault and reads its live liquidity', async () => {
    const found = await discoverMarketsByCollateral({ provider, collateralTokens: [VAULT] });
    const entry = found.get(VAULT.toLowerCase())?.[0];
    expect(entry?.marketId).toBe(MARKET_A);
    expect(entry?.supplyAssets).toBe('500.0');
    expect(entry?.availableAssets).toBe('500.0');
  });

  it('finds a market created with a non-default LLTV, which a recomputed id would miss', async () => {
    logs = [createMarketLog(MARKET_A, VAULT, 860_000_000_000_000_000n)];
    const found = await discoverMarketsByCollateral({ provider, collateralTokens: [VAULT] });
    expect(found.get(VAULT.toLowerCase())?.[0].lltv).toBe('860000000000000000');
  });

  it('ignores markets whose collateral is not ours', async () => {
    logs = [createMarketLog(MARKET_B, '0x9999999999999999999999999999999999999999', 1n)];
    const found = await discoverMarketsByCollateral({ provider, collateralTokens: [VAULT] });
    expect(found.size).toBe(0);
  });

  it('separates markets per vault', async () => {
    logs = [
      createMarketLog(MARKET_A, VAULT, 1n),
      createMarketLog(MARKET_B, OTHER_VAULT, 1n)
    ];
    markets = {
      [MARKET_A]: [1_000_000n, 0n, 0n, 0n, 0n, 0n],
      [MARKET_B]: [2_000_000n, 0n, 0n, 0n, 0n, 0n]
    };
    const found = await discoverMarketsByCollateral({
      provider,
      collateralTokens: [VAULT, OTHER_VAULT]
    });
    expect(found.get(VAULT.toLowerCase())?.[0].marketId).toBe(MARKET_A);
    expect(found.get(OTHER_VAULT.toLowerCase())?.[0].marketId).toBe(MARKET_B);
  });

  it('orders several markets for one vault by available liquidity', async () => {
    logs = [createMarketLog(MARKET_A, VAULT, 1n), createMarketLog(MARKET_B, VAULT, 2n)];
    markets = {
      [MARKET_A]: [1_000_000n, 0n, 0n, 0n, 0n, 0n],
      [MARKET_B]: [900_000_000n, 0n, 0n, 0n, 0n, 0n]
    };
    const found = await discoverMarketsByCollateral({ provider, collateralTokens: [VAULT] });
    expect(found.get(VAULT.toLowerCase())?.map((row) => row.marketId)).toEqual([
      MARKET_B,
      MARKET_A
    ]);
  });

  it('subtracts what is borrowed from what is available', async () => {
    markets = { [MARKET_A]: [500_000_000n, 0n, 200_000_000n, 0n, 0n, 0n] };
    const found = await discoverMarketsByCollateral({ provider, collateralTokens: [VAULT] });
    expect(found.get(VAULT.toLowerCase())?.[0].availableAssets).toBe('300.0');
  });

  it('falls back to chunked scanning when one wide query is refused', async () => {
    getLogsFails = true;
    const found = await discoverMarketsByCollateral({ provider, collateralTokens: [VAULT] });
    // Every chunk is refused too, so it reports nothing rather than throwing.
    expect(found.size).toBe(0);
  });

  it('returns nothing when asked about no vaults', async () => {
    const found = await discoverMarketsByCollateral({ provider, collateralTokens: [] });
    expect(found.size).toBe(0);
  });
});
