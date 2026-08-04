import { JsonRpcProvider } from 'ethers';
import { listAdminAssets, updateAdminAsset, type AdminAssetRecord } from '../admin/assetsService';
import { usdcDecimals } from '../payments/paymentConfig';
import { discoverMarketsByCollateral, type DiscoveredMarket } from './morphoMarketDiscovery';

export type MorphoReconcileRow = {
  projectId: string;
  title: string;
  vaultAddress: string | null;
  /** Market id the project had registered, if any. */
  storedMarketId: string | null;
  /** Market the chain says holds this vault's liquidity. */
  discoveredMarketId: string | null;
  marketsFound: number;
  supplyAssets: string | null;
  availableAssets: string | null;
  liquidityBefore: string | null;
  liquidityAfter: string | null;
  /** What reconciliation changed, if anything. */
  actions: string[];
};

export type MorphoReconcileResult = {
  generatedAt: string;
  rows: MorphoReconcileRow[];
  summary: {
    projects: number;
    marketsDiscovered: number;
    marketIdsCorrected: number;
    liquidityCorrected: number;
  };
};

function morphoTargetOf(asset: AdminAssetRecord) {
  return asset.collateralTargets.find((target) => target.protocol === 'MORPHO') ?? null;
}

/**
 * Bring every asset's Morpho registration in line with the chain, in one pass.
 *
 * Reads the markets that actually exist for each vault, records the one holding
 * the liquidity, and derives the liquidity status from it. This replaces
 * confirming assets one by one: the chain is the source of truth and the stored
 * values are a cache that this repairs, so a bad reading can no longer outlive
 * the condition that caused it.
 */
export async function reconcileMorphoMarkets(input: {
  provider: JsonRpcProvider;
  projectIds?: string[];
  /** Report what it would change without writing. */
  dryRun?: boolean;
}): Promise<MorphoReconcileResult> {
  const assets = await listAdminAssets();
  const targets = input.projectIds?.length
    ? assets.filter((asset) => input.projectIds!.includes(asset.id))
    : assets;

  const withVault = targets.filter((asset) => Boolean(asset.vaultAddress?.trim()));

  const discovered = await discoverMarketsByCollateral({
    provider: input.provider,
    collateralTokens: withVault.map((asset) => asset.vaultAddress!.trim()),
    loanDecimals: usdcDecimals()
  });

  const rows: MorphoReconcileRow[] = [];
  let marketsDiscovered = 0;
  let marketIdsCorrected = 0;
  let liquidityCorrected = 0;

  for (const asset of withVault) {
    const vault = asset.vaultAddress!.trim();
    const markets: DiscoveredMarket[] = discovered.get(vault.toLowerCase()) ?? [];
    const best = markets[0] ?? null;
    const target = morphoTargetOf(asset);
    const storedMarketId = target?.externalId?.trim() || null;
    const liquidityBefore = asset.morphoLiquidityStatus ?? null;
    const actions: string[] = [];

    marketsDiscovered += markets.length;

    if (!best) {
      rows.push({
        projectId: asset.id,
        title: asset.title,
        vaultAddress: vault,
        storedMarketId,
        discoveredMarketId: null,
        marketsFound: 0,
        supplyAssets: null,
        availableAssets: null,
        liquidityBefore,
        liquidityAfter: liquidityBefore,
        actions: ['sin mercado en Morpho para este vault']
      });
      continue;
    }

    const liquidityAfter = Number(best.availableAssets) > 0 ? 'LIQUID' : 'NO_LIQUIDITY';
    const patch: Parameters<typeof updateAdminAsset>[1] = {};

    if (storedMarketId !== best.marketId) {
      actions.push(
        storedMarketId
          ? `market id corregido: ${storedMarketId} → ${best.marketId}`
          : `market id registrado: ${best.marketId}`
      );
      marketIdsCorrected += 1;

      if (target) {
        patch.collateralTargets = asset.collateralTargets.map((row) =>
          row.protocol === 'MORPHO'
            ? { ...row, externalId: best.marketId, oracleAddress: row.oracleAddress ?? best.oracle }
            : row
        );
      }
    }

    if (liquidityBefore !== liquidityAfter) {
      actions.push(`liquidez: ${liquidityBefore ?? 'sin dato'} → ${liquidityAfter}`);
      liquidityCorrected += 1;
      patch.morphoLiquidityStatus = liquidityAfter;
    }

    if (markets.length > 1) {
      actions.push(`${markets.length} mercados para este vault; se eligió el de mayor liquidez`);
    }

    if (!input.dryRun && Object.keys(patch).length > 0) {
      await updateAdminAsset(asset.id, patch);
    }

    rows.push({
      projectId: asset.id,
      title: asset.title,
      vaultAddress: vault,
      storedMarketId,
      discoveredMarketId: best.marketId,
      marketsFound: markets.length,
      supplyAssets: best.supplyAssets,
      availableAssets: best.availableAssets,
      liquidityBefore,
      liquidityAfter,
      actions: actions.length ? actions : ['ya coincidía con la cadena']
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    rows,
    summary: {
      projects: rows.length,
      marketsDiscovered,
      marketIdsCorrected,
      liquidityCorrected
    }
  };
}
