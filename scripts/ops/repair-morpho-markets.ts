#!/usr/bin/env node
/**
 * Repair Morpho collateral targets: sync market id, oracle and pool URL (with slug) from on-chain.
 *
 *   npx tsx scripts/ops/repair-morpho-markets.ts
 *   npx tsx scripts/ops/repair-morpho-markets.ts proj-apart-hotel-urban-view-anelo-mplonxbv
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Contract, JsonRpcProvider } from 'ethers';
import { getLendingChainConfig } from '../../apps/web/src/lib/lending/baseContracts.ts';
import { buildMorphoMarketPoolUrl, KNOWN_MORPHO_MARKET_SLUGS } from '../../apps/web/src/lib/lending/morphoMarketUrls.ts';
import { listAdminAssets, updateAdminAsset } from '../../apps/web/src/lib/admin/assetsService.ts';
import { probeMorphoLiquidityStatus } from '../../apps/web/src/lib/lending/morphoLiquidityCheck.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
config({ path: resolve(root, 'packages/database/.env') });
if (process.env.DIRECT_URL?.trim()) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const rpc =
  process.env.LENDING_BASE_RPC_URL?.trim() ||
  process.env.BASE_RPC_URL?.trim() ||
  'https://mainnet.base.org';

async function readMarketOracle(marketId: string): Promise<string | null> {
  const provider = new JsonRpcProvider(rpc);
  try {
    const morpho = new Contract(
      getLendingChainConfig().morpho,
      ['function idToMarketParams(bytes32 id) view returns (address,address,address,address,uint256)'],
      provider
    );
    const params = await morpho.idToMarketParams(marketId);
    return (params.oracle ?? params[2] ?? null) as string | null;
  } finally {
    provider.destroy();
  }
}

async function repairAsset(projectId: string, marketId: string) {
  const assets = await listAdminAssets('ALL');
  const asset = assets.find((row) => row.id === projectId);
  if (!asset?.vaultAddress) {
    throw new Error(`Asset ${projectId} missing or vault not deployed`);
  }

  const oracle = await readMarketOracle(marketId);
  if (!oracle) {
    throw new Error(`Market ${marketId} not found on-chain for ${projectId}`);
  }

  await updateAdminAsset(projectId, {
    collateralTargets: [
      {
        protocol: 'MORPHO',
        status: 'REGISTERED',
        readinessScore: 100,
        missingRequirements: [],
        externalId: marketId,
        poolUrl: buildMorphoMarketPoolUrl(marketId, asset.tokenSymbol),
        oracleAddress: oracle,
        notes: `Mercado Morpho Blue reparado (${marketId}).`,
        submittedAt: new Date().toISOString(),
        registeredAt: new Date().toISOString(),
        lastError: null
      }
    ]
  });

  const refreshed = assets.find((row) => row.id === projectId) ?? (await listAdminAssets('ALL')).find((r) => r.id === projectId);
  if (refreshed) {
    await probeMorphoLiquidityStatus(refreshed);
  }

  const finalAsset = (await listAdminAssets('ALL')).find((row) => row.id === projectId);
  console.log('[repair]', projectId, {
    marketId,
    oracle,
    poolUrl: buildMorphoMarketPoolUrl(marketId, asset.tokenSymbol),
    readyToBorrow: finalAsset?.readyToBorrow,
    morphoLiquidityStatus: finalAsset?.morphoLiquidityStatus
  });
}

const DEFAULT_REPAIRS: Array<{ projectId: string; marketId: string }> = [
  {
    projectId: 'proj-apart-hotel-urban-view-anelo-mplonxbv',
    marketId: '0x114aee5443b74e9527c14fad35968a4fe98090941888fc8c8a88d4c33c3936e7'
  },
  {
    projectId: 'proj-anelo-apart-hotel-urban-view',
    marketId: '0xacc94a3f8cf6c3bd4060d02a2888027540db4a147dc2d7249472b1623d102209'
  }
];

async function main() {
  const explicitId = process.argv[2]?.trim();
  const repairs = explicitId
    ? DEFAULT_REPAIRS.filter((row) => row.projectId === explicitId)
    : DEFAULT_REPAIRS;

  if (explicitId && repairs.length === 0) {
    throw new Error(`Unknown project id "${explicitId}". Known: ${DEFAULT_REPAIRS.map((r) => r.projectId).join(', ')}`);
  }

  for (const row of repairs) {
    try {
      await repairAsset(row.projectId, row.marketId);
    } catch (error) {
      console.error('[repair] failed', row.projectId, error instanceof Error ? error.message : error);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
