import { prisma } from '@sanova/database';
import {
  isPrivyEarnConfigured,
  listConfiguredPrivyEarnVaultIds,
  privyEarnVaultDisplayOrder,
  resolvePrivyEarnVaultAddressById,
  resolvePrivyEarnVaultDisplayName
} from './config';
import { getPrivyVaultDetails } from './earnApi';

export type PrivyEarnVaultCatalogItem = {
  vaultId: string;
  name: string;
  provider: string;
  vaultAddress: string;
  assetSymbol: string;
  userApyPercent: number;
  tvlUsd: number;
  availableLiquidityUsd: number;
  projectId: string | null;
  projectTitle: string | null;
  checkoutHref: string;
};

function parseApyPercent(details: Record<string, unknown>): number {
  const bps = details.user_apy;
  if (typeof bps === 'number' && Number.isFinite(bps)) {
    return bps / 100;
  }
  if (typeof bps === 'string') {
    const parsed = Number.parseFloat(bps);
    if (Number.isFinite(parsed)) {
      return parsed / 100;
    }
  }
  return 0;
}

function parseUsd(details: Record<string, unknown>, key: string): number {
  const value = details[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function resolveVaultAddress(details: Record<string, unknown>, vaultId: string): string {
  const fromApi =
    typeof details.vault_address === 'string'
      ? details.vault_address
      : typeof details.vaultAddress === 'string'
        ? details.vaultAddress
        : '';
  return fromApi.trim() || resolvePrivyEarnVaultAddressById(vaultId) || '';
}

function resolveAssetSymbol(details: Record<string, unknown>): string {
  const asset = details.asset;
  if (asset && typeof asset === 'object' && typeof (asset as { symbol?: string }).symbol === 'string') {
    return (asset as { symbol: string }).symbol.toUpperCase();
  }
  return 'USDC';
}

function buildCheckoutHref(vaultId: string, vaultAddress: string): string {
  const params = new URLSearchParams({
    mode: 'deposit',
    returnTo: '/dashboard/inversiones'
  });
  if (vaultId.trim()) {
    params.set('earnVaultId', vaultId.trim());
  }
  if (vaultAddress.trim()) {
    params.set('vaultAddress', vaultAddress.trim());
  }
  return `/marketplace/carrito?${params.toString()}`;
}

function buildCatalogItem(input: {
  vaultId: string;
  details?: Record<string, unknown>;
  project?: { id: string; title: string } | null;
}): PrivyEarnVaultCatalogItem {
  const details = input.details ?? {};
  const vaultAddress = resolveVaultAddress(details, input.vaultId);
  const apiName = typeof details.name === 'string' ? details.name : null;

  return {
    vaultId: typeof details.id === 'string' ? details.id : input.vaultId,
    name: resolvePrivyEarnVaultDisplayName(input.vaultId, apiName),
    provider: typeof details.provider === 'string' ? details.provider : 'earn',
    vaultAddress,
    assetSymbol: resolveAssetSymbol(details),
    userApyPercent: parseApyPercent(details),
    tvlUsd: parseUsd(details, 'tvl_usd'),
    availableLiquidityUsd: parseUsd(details, 'available_liquidity_usd'),
    projectId: input.project?.id ?? null,
    projectTitle: input.project?.title ?? null,
    checkoutHref: buildCheckoutHref(input.vaultId, vaultAddress)
  };
}

function sortVaultsByDisplayOrder(vaults: PrivyEarnVaultCatalogItem[]): PrivyEarnVaultCatalogItem[] {
  const order = privyEarnVaultDisplayOrder();
  return [...vaults].sort((a, b) => {
    const aIndex = order.indexOf(a.vaultId);
    const bIndex = order.indexOf(b.vaultId);
    if (aIndex === -1 && bIndex === -1) {
      return b.userApyPercent - a.userApyPercent;
    }
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

export async function listPrivyEarnVaultCatalog(): Promise<{
  vaults: PrivyEarnVaultCatalogItem[];
  updatedAt: string;
}> {
  if (!isPrivyEarnConfigured()) {
    return { vaults: [], updatedAt: new Date().toISOString() };
  }

  const vaultIds = listConfiguredPrivyEarnVaultIds();
  if (!vaultIds.length) {
    return { vaults: [], updatedAt: new Date().toISOString() };
  }

  const projects = await prisma.project.findMany({
    where: { vaultAddress: { not: null }, isActive: true },
    select: { id: true, title: true, vaultAddress: true }
  });

  const projectByVault = new Map<string, { id: string; title: string }>();
  for (const project of projects) {
    const address = project.vaultAddress?.trim().toLowerCase();
    if (address) {
      projectByVault.set(address, { id: project.id, title: project.title });
    }
  }

  const vaults: PrivyEarnVaultCatalogItem[] = [];

  for (const vaultId of vaultIds) {
    try {
      const details = (await getPrivyVaultDetails(vaultId)) as Record<string, unknown>;
      const vaultAddress = resolveVaultAddress(details, vaultId);
      const project = vaultAddress ? projectByVault.get(vaultAddress.toLowerCase()) : undefined;
      vaults.push(buildCatalogItem({ vaultId, details, project }));
    } catch (error) {
      console.error('[privyEarnVaultCatalog]', vaultId, error);
      vaults.push(buildCatalogItem({ vaultId, project: null }));
    }
  }

  return { vaults: sortVaultsByDisplayOrder(vaults), updatedAt: new Date().toISOString() };
}
