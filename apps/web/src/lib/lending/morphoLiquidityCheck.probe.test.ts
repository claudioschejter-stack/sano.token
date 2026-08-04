import { beforeEach, describe, expect, it, vi } from 'vitest';

const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
let marketRead: () => Promise<unknown>;

vi.mock('../admin/assetsService', () => ({
  appendDeploymentEvent: async () => undefined,
  getAdminAsset: async () => null,
  updateAdminAsset: async (id: string, patch: Record<string, unknown>) => {
    updates.push({ id, patch });
  }
}));

vi.mock('../admin/automationAlerts', () => ({ notifyMorphoLiquidity: async () => undefined }));
vi.mock('../blockchain/explorerUrls', () => ({ resolveMorphoChainId: () => 8453 }));
vi.mock('./baseContracts', () => ({
  getLendingChainConfig: () => ({ morpho: '0x1111111111111111111111111111111111111111' })
}));
vi.mock('./protocols/morphoBorrow', () => ({
  buildDefaultMorphoMarketParams: () => ({ loanToken: '0x2', collateralToken: '0x3' }),
  resolveMorphoMarketId: () => '0xmarket'
}));

vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');
  class FakeContract {
    async market() {
      return marketRead();
    }
  }
  class FakeProvider {
    destroy() {}
  }
  return { ...actual, Contract: FakeContract, JsonRpcProvider: FakeProvider };
});

const { probeMorphoLiquidityStatus } = await import('./morphoLiquidityCheck');

const asset = {
  id: 'proj-1',
  title: 'Activo',
  vaultAddress: '0x4444444444444444444444444444444444444444',
  totalTokens: 100,
  pricePerToken: 10,
  collateralTargets: [
    { protocol: 'MORPHO', oracleAddress: '0x5555555555555555555555555555555555555555' }
  ]
} as never;

beforeEach(() => {
  updates.length = 0;
});

describe('probeMorphoLiquidityStatus', () => {
  it('stores LIQUID when the market has assets available', async () => {
    marketRead = async () => ({ totalSupplyAssets: 500_000_000n, totalBorrowAssets: 0n });
    const result = await probeMorphoLiquidityStatus(asset);
    expect(result.status).toBe('LIQUID');
    expect(updates.at(-1)?.patch).toEqual({ morphoLiquidityStatus: 'LIQUID' });
  });

  it('stores NO_LIQUIDITY when everything supplied is borrowed', async () => {
    marketRead = async () => ({ totalSupplyAssets: 100n, totalBorrowAssets: 100n });
    const result = await probeMorphoLiquidityStatus(asset);
    expect(result.status).toBe('NO_LIQUIDITY');
    expect(updates.at(-1)?.patch).toEqual({ morphoLiquidityStatus: 'NO_LIQUIDITY' });
  });

  it('leaves the stored status alone when the RPC is throttling', async () => {
    marketRead = async () => {
      throw new Error('missing revert data');
    };
    const result = await probeMorphoLiquidityStatus(asset);
    expect(result.status).toBe('UNKNOWN');
    expect(updates).toHaveLength(0);
  });

  it('recovers when a throttled read succeeds on retry', async () => {
    let calls = 0;
    marketRead = async () => {
      calls += 1;
      if (calls < 2) throw new Error('missing revert data');
      return { totalSupplyAssets: 500_000_000n, totalBorrowAssets: 0n };
    };
    const result = await probeMorphoLiquidityStatus(asset);
    expect(result.status).toBe('LIQUID');
  });

  it('still records FAILED for a real contract error', async () => {
    marketRead = async () => {
      throw new Error('execution reverted: bad market');
    };
    const result = await probeMorphoLiquidityStatus(asset);
    expect(result.status).toBe('FAILED');
    expect(updates.at(-1)?.patch).toEqual({ morphoLiquidityStatus: 'FAILED' });
  });
});
