/**
 * Unified vault catalog that combines:
 *   1. Morpho yield vaults (DeFi — Gauntlet, Steakhouse, etc.)
 *   2. Platform RWA project vaults (tokenized real estate from the DB)
 *
 * Both types share the same PrivyEarnVaultCatalogItem shape so the UI
 * (PrivyEarnVaultsPanel) works unchanged.
 *
 * To add a new Morpho vault: update MORPHO_VAULT_ADDRESSES in Vercel:
 *   [{"address":"0x...","name":"Vault Name","chainId":8453}]
 *
 * To add a new platform vault: create a Project in the DB with isActive=true
 * and vaultAddress set.
 */

import { prisma } from '@sanova/database';
import type { PrivyEarnVaultCatalogItem } from '../privy/privyEarnVaultCatalog';
import { fetchMorphoVaultData, parseMorphoVaultConfigs } from '../morpho/morphoEarnService';

function buildCheckoutHref(params: Record<string, string>): string {
  const url = new URLSearchParams({
    mode: 'deposit',
    returnTo: '/dashboard/inversiones',
    ...params
  });
  return `/marketplace/carrito?${url.toString()}`;
}

async function buildMorphoVaultItems(): Promise<PrivyEarnVaultCatalogItem[]> {
  const configs = parseMorphoVaultConfigs();
  if (!configs.length) return [];

  let dataMap: Map<string, Awaited<ReturnType<typeof fetchMorphoVaultData>> extends Map<string, infer V> ? V : never>;
  try {
    dataMap = await fetchMorphoVaultData(configs);
  } catch (err) {
    console.error('[unifiedVaultCatalog] Morpho fetch failed:', err);
    // Return placeholder rows so the UI still shows the vaults
    return configs.map((cfg) => ({
      vaultId: cfg.address.toLowerCase(),
      name: cfg.displayName ?? cfg.address,
      provider: 'morpho',
      vaultAddress: cfg.address,
      assetSymbol: 'USDC',
      userApyPercent: 0,
      tvlUsd: 0,
      availableLiquidityUsd: 0,
      projectId: null,
      projectTitle: null,
      checkoutHref: buildCheckoutHref({ vaultAddress: cfg.address })
    }));
  }

  return configs.map((cfg) => {
    const data = dataMap.get(cfg.address.toLowerCase());
    return {
      vaultId: cfg.address.toLowerCase(),
      name: data?.name ?? cfg.displayName ?? cfg.address,
      provider: 'morpho',
      vaultAddress: cfg.address,
      assetSymbol: data?.assetSymbol ?? 'USDC',
      userApyPercent: data?.netApyPercent ?? 0,
      tvlUsd: data?.tvlUsd ?? 0,
      availableLiquidityUsd: data?.tvlUsd ?? 0,
      projectId: null,
      projectTitle: null,
      checkoutHref: buildCheckoutHref({ vaultAddress: cfg.address })
    };
  });
}

async function buildPlatformVaultItems(): Promise<PrivyEarnVaultCatalogItem[]> {
  const projects = await prisma.project.findMany({
    where: { isActive: true, vaultAddress: { not: null } },
    select: {
      id: true,
      title: true,
      vaultAddress: true,
      targetYield: true,
      totalTokens: true,
      availableTokens: true,
      pricePerToken: true,
      tokenSymbol: true
    }
  });

  return projects.map((p) => {
    const soldTokens = (p.totalTokens ?? 0) - (p.availableTokens ?? 0);
    const pricePerToken = Number(p.pricePerToken ?? 0);
    const tvlUsd = soldTokens * pricePerToken;
    const availableLiquidityUsd = (p.availableTokens ?? 0) * pricePerToken;

    return {
      vaultId: `platform:${p.id}`,
      name: p.title,
      provider: 'sanova',
      vaultAddress: p.vaultAddress ?? '',
      assetSymbol: p.tokenSymbol ?? 'RWA',
      userApyPercent: Number(p.targetYield ?? 0),
      tvlUsd,
      availableLiquidityUsd,
      projectId: p.id,
      projectTitle: p.title,
      checkoutHref: buildCheckoutHref({ projectId: p.id })
    };
  });
}

export async function listUnifiedVaultCatalog(): Promise<{
  vaults: PrivyEarnVaultCatalogItem[];
  updatedAt: string;
}> {
  // "Inversiones" only shows external DeFi yield vaults (Morpho/Privy). Tokenized
  // property RWA positions ("sanova" provider) belong to the Propiedades/Marketplace
  // section instead, so they're intentionally excluded here — see buildPlatformVaultItems.
  const [morphoVaults] = await Promise.allSettled([buildMorphoVaultItems()]);

  const vaults: PrivyEarnVaultCatalogItem[] = morphoVaults.status === 'fulfilled' ? morphoVaults.value : [];

  return { vaults, updatedAt: new Date().toISOString() };
}
