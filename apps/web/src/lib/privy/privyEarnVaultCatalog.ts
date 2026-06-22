import { prisma } from '@sanova/database';
import {
  isPrivyEarnConfigured,
  listConfiguredPrivyEarnVaultIds,
  privyVaultId
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

function resolveVaultAddress(details: Record<string, unknown>): string {
  const address =
    typeof details.vault_address === 'string'
      ? details.vault_address
      : typeof details.vaultAddress === 'string'
        ? details.vaultAddress
        : '';
  return address.trim();
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
      const details = await getPrivyVaultDetails(vaultId);
      const vaultAddress = resolveVaultAddress(details);
      const normalizedAddress = vaultAddress.toLowerCase();
      const project = normalizedAddress ? projectByVault.get(normalizedAddress) : undefined;

      vaults.push({
        vaultId: typeof details.id === 'string' ? details.id : vaultId,
        name: typeof details.name === 'string' ? details.name : vaultId,
        provider: typeof details.provider === 'string' ? details.provider : 'earn',
        vaultAddress,
        assetSymbol: resolveAssetSymbol(details),
        userApyPercent: parseApyPercent(details),
        tvlUsd: parseUsd(details, 'tvl_usd'),
        availableLiquidityUsd: parseUsd(details, 'available_liquidity_usd'),
        projectId: project?.id ?? null,
        projectTitle: project?.title ?? null,
        checkoutHref: buildCheckoutHref(
          typeof details.id === 'string' ? details.id : vaultId,
          vaultAddress
        )
      });
    } catch (error) {
      console.error('[privyEarnVaultCatalog]', vaultId, error);
      if (vaultId === privyVaultId()) {
        vaults.push({
          vaultId,
          name: vaultId,
          provider: 'earn',
          vaultAddress: '',
          assetSymbol: 'USDC',
          userApyPercent: 0,
          tvlUsd: 0,
          availableLiquidityUsd: 0,
          projectId: null,
          projectTitle: null,
          checkoutHref: buildCheckoutHref(vaultId, '')
        });
      }
    }
  }

  vaults.sort((a, b) => b.userApyPercent - a.userApyPercent);

  return { vaults, updatedAt: new Date().toISOString() };
}
