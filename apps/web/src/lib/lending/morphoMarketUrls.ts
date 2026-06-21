import type { CollateralTarget } from '../admin/launchTypes';

/** Known Base mainnet Morpho Blue markets (market id → URL slug). */
export const KNOWN_MORPHO_MARKET_SLUGS: Record<string, string> = {
  '0x114aee5443b74e9527c14fad35968a4fe98090941888fc8c8a88d4c33c3936e7': 'vanelouv-usdc',
  '0xacc94a3f8cf6c3bd4060d02a2888027540db4a147dc2d7249472b1623d102209': 'vuv3rwa-usdc'
};

export function resolveMorphoMarketSlug(
  marketId: string,
  collateralSymbol?: string | null
): string | null {
  const normalizedId = marketId.trim().toLowerCase();
  const known = KNOWN_MORPHO_MARKET_SLUGS[normalizedId];
  if (known) {
    return known;
  }

  if (!collateralSymbol?.trim()) {
    return null;
  }

  const symbol = collateralSymbol.trim().toLowerCase();
  if (symbol.endsWith('-usdc')) {
    return symbol;
  }

  const vaultSymbol = symbol.startsWith('v') ? symbol : `v${symbol}`;
  return `${vaultSymbol}-usdc`;
}

/** In-app borrow flow (Morpho Blue txs prepared by Sanova on Base). */
export function buildSanovaBorrowPath(projectId: string): string {
  return `/marketplace/${encodeURIComponent(projectId.trim())}/prestamo`;
}

export function buildMorphoMarketPoolUrl(marketId: string, collateralSymbol?: string | null): string {
  const normalizedId = marketId.trim();
  const slug = resolveMorphoMarketSlug(normalizedId, collateralSymbol);
  const base = `https://app.morpho.org/base/market/${normalizedId}`;
  return slug ? `${base}/${slug}#market` : `${base}#market`;
}

export function normalizeMorphoCollateralTargets(
  targets: CollateralTarget[],
  collateralSymbol?: string | null
): CollateralTarget[] {
  return targets.map((target) => {
    if (target.protocol !== 'MORPHO' || !target.externalId?.trim()) {
      return target;
    }

    const poolUrl = buildMorphoMarketPoolUrl(target.externalId, collateralSymbol);

    return {
      ...target,
      poolUrl
    };
  });
}
