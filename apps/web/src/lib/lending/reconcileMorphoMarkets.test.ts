import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiscoveredMarket } from './morphoMarketDiscovery';

const VAULT_A = '0x125782B1302be9a2f58849f8A86F25F78009b367';
const VAULT_B = '0x95F1359144c66C8dDFd709D7111a36CAE8bb6089';
const MARKET_REAL = '0xacc94a3f8cf6c3bd4060d02a2888027540db4a147dc2d7249472b1623d102209';
const MARKET_WRONG = '0x1111111111111111111111111111111111111111111111111111111111111111';

const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
let assets: Array<Record<string, unknown>> = [];
let byCollateral = new Map<string, DiscoveredMarket[]>();
let scanSucceeds = true;
/** Overridden per test to model what the chain says about a stored id. */
let verifyResult: (marketId: string) => unknown = () => ({ ok: false, reason: 'NOT_FOUND' });

vi.mock('../admin/assetsService', () => ({
  listAdminAssets: async () => assets,
  updateAdminAsset: async (id: string, patch: Record<string, unknown>) => {
    updates.push({ id, patch });
  }
}));
vi.mock('../payments/paymentConfig', () => ({ usdcDecimals: () => 6 }));
vi.mock('./morphoMarketDiscovery', () => ({
  discoverMarketsByCollateral: async () => ({ scanned: scanSucceeds, byCollateral }),
  verifyStoredMarket: async (input: { marketId: string }) => verifyResult(input.marketId)
}));

const { reconcileMorphoMarkets } = await import('./reconcileMorphoMarkets');

function market(overrides: Partial<DiscoveredMarket>): DiscoveredMarket {
  return {
    marketId: MARKET_REAL,
    collateralToken: VAULT_A,
    loanToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    oracle: '0x81bc0d8e0207E140b3101EB8Ffd2C387bD30AAEa',
    irm: '0x46415998764C29aB2a25CbeA6254146D50D22687',
    lltv: '625000000000000000',
    supplyAssets: '500.0',
    borrowAssets: '0.0',
    availableAssets: '500.0',
    ...overrides
  };
}

function asset(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj-a',
    title: 'Activo A',
    vaultAddress: VAULT_A,
    morphoLiquidityStatus: 'FAILED',
    collateralTargets: [{ protocol: 'MORPHO', externalId: null, oracleAddress: null }],
    ...overrides
  };
}

const provider = {} as never;

beforeEach(() => {
  updates.length = 0;
  scanSucceeds = true;
  assets = [asset()];
  byCollateral = new Map([[VAULT_A.toLowerCase(), [market({})]]]);
  verifyResult = () => ({ ok: false, reason: 'NOT_FOUND' });
});

describe('reconcileMorphoMarkets', () => {
  it('trusts a stored id the chain confirms, without scanning', async () => {
    assets = [
      asset({
        collateralTargets: [{ protocol: 'MORPHO', externalId: MARKET_REAL, oracleAddress: null }]
      })
    ];
    verifyResult = () => ({ ok: true, market: market({ marketId: MARKET_REAL }) });
    // A scan would find nothing, so a pass here proves the stored id was used.
    byCollateral = new Map();

    const result = await reconcileMorphoMarkets({ provider });

    expect(result.rows[0]).toMatchObject({
      discoveredMarketId: MARKET_REAL,
      liquidityAfter: 'LIQUID',
      availableAssets: '500.0'
    });
    expect(result.rows[0].actions.join(' ')).not.toContain('sin mercado');
  });

  it('does not claim a vault has no market when the scan could not run', async () => {
    scanSucceeds = false;
    byCollateral = new Map();

    const result = await reconcileMorphoMarkets({ provider });

    expect(result.rows[0].actions.join(' ')).toContain('no se pudo determinar');
    expect(result.rows[0].liquidityAfter).toBe('FAILED');
    expect(updates).toHaveLength(0);
  });

  it('does not scan on account of a read that failed', async () => {
    assets = [
      asset({
        collateralTargets: [{ protocol: 'MORPHO', externalId: MARKET_REAL, oracleAddress: null }]
      })
    ];
    verifyResult = () => ({ ok: false, reason: 'READ_FAILED' });
    byCollateral = new Map();

    const result = await reconcileMorphoMarkets({ provider });

    expect(result.rows[0].actions.join(' ')).toContain('read_failed');
    expect(result.rows[0].actions.join(' ')).toContain('no se pudo determinar');
    expect(updates).toHaveLength(0);
  });

  it('scans when the stored id points at another vault', async () => {
    assets = [
      asset({
        collateralTargets: [{ protocol: 'MORPHO', externalId: MARKET_WRONG, oracleAddress: null }]
      })
    ];
    verifyResult = () => ({ ok: false, reason: 'COLLATERAL_MISMATCH', detail: VAULT_B });

    const result = await reconcileMorphoMarkets({ provider });

    expect(result.rows[0].actions.join(' ')).toContain('collateral_mismatch');
    expect(result.rows[0].discoveredMarketId).toBe(MARKET_REAL);
  });

  it('records the market the chain has and corrects the liquidity status', async () => {
    const result = await reconcileMorphoMarkets({ provider });

    expect(result.rows[0]).toMatchObject({
      discoveredMarketId: MARKET_REAL,
      liquidityBefore: 'FAILED',
      liquidityAfter: 'LIQUID',
      availableAssets: '500.0'
    });
    expect(updates[0].patch.morphoLiquidityStatus).toBe('LIQUID');
  });

  it('replaces a stored market id that does not match the chain', async () => {
    assets = [
      asset({
        collateralTargets: [{ protocol: 'MORPHO', externalId: MARKET_WRONG, oracleAddress: null }]
      })
    ];

    const result = await reconcileMorphoMarkets({ provider });

    expect(result.rows[0].actions.join(' ')).toContain('market id corregido');
    const targets = updates[0].patch.collateralTargets as Array<{ externalId: string }>;
    expect(targets[0].externalId).toBe(MARKET_REAL);
    expect(result.summary.marketIdsCorrected).toBe(1);
  });

  it('writes nothing on a dry run', async () => {
    const result = await reconcileMorphoMarkets({ provider, dryRun: true });
    expect(result.rows[0].liquidityAfter).toBe('LIQUID');
    expect(updates).toHaveLength(0);
  });

  it('marks NO_LIQUIDITY when everything supplied is borrowed', async () => {
    byCollateral = new Map([
      [VAULT_A.toLowerCase(), [market({ supplyAssets: '100.0', borrowAssets: '100.0', availableAssets: '0.0' })]]
    ]);
    const result = await reconcileMorphoMarkets({ provider });
    expect(result.rows[0].liquidityAfter).toBe('NO_LIQUIDITY');
  });

  it('reports an asset whose vault has no market, without touching it', async () => {
    byCollateral = new Map();
    const result = await reconcileMorphoMarkets({ provider });
    expect(result.rows[0]).toMatchObject({ marketsFound: 0, discoveredMarketId: null });
    expect(result.rows[0].actions[0]).toContain('sin mercado');
    expect(updates).toHaveLength(0);
  });

  it('picks the market holding the most liquidity when a vault has several', async () => {
    byCollateral = new Map([
      [
        VAULT_A.toLowerCase(),
        [
          market({ marketId: MARKET_REAL, availableAssets: '500.0' }),
          market({ marketId: MARKET_WRONG, availableAssets: '1.0' })
        ]
      ]
    ]);
    const result = await reconcileMorphoMarkets({ provider });
    expect(result.rows[0].discoveredMarketId).toBe(MARKET_REAL);
    expect(result.rows[0].actions.join(' ')).toContain('2 mercados');
  });

  it('reconciles every asset in one pass', async () => {
    assets = [asset(), asset({ id: 'proj-b', title: 'Activo B', vaultAddress: VAULT_B })];
    byCollateral = new Map([
      [VAULT_A.toLowerCase(), [market({})]],
      [VAULT_B.toLowerCase(), [market({ marketId: MARKET_WRONG, collateralToken: VAULT_B })]]
    ]);

    const result = await reconcileMorphoMarkets({ provider });

    expect(result.summary.projects).toBe(2);
    expect(result.rows.map((row) => row.liquidityAfter)).toEqual(['LIQUID', 'LIQUID']);
  });

  it('skips assets without a vault', async () => {
    assets = [asset({ vaultAddress: null })];
    const result = await reconcileMorphoMarkets({ provider });
    expect(result.rows).toHaveLength(0);
  });
});
