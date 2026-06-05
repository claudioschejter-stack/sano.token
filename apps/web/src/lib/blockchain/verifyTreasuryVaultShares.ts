import { resolveTreasuryAddress } from './treasuryPolicy';
import type { AdminAssetRecord } from '../admin/assetsService';
import { readIssuerVaultReadiness } from '../admin/verifyIssuerVaultShares';

export async function readTreasuryVaultReadiness(asset: AdminAssetRecord) {
  const treasury = resolveTreasuryAddress();
  if (!treasury) {
    return { treasury: null, hasShares: false, kycApproved: false };
  }

  const readiness = await readIssuerVaultReadiness(asset, treasury);
  return { treasury, ...readiness };
}

export async function assertTreasuryVaultSharesReady(asset: {
  vaultAddress: string | null;
  contractAddress: string | null;
  chainId: number | null;
}): Promise<{ ok: true; treasury: string } | { ok: false; reason: string }> {
  const treasury = resolveTreasuryAddress();
  if (!treasury) {
    return { ok: false, reason: 'Treasury Safe no configurado.' };
  }

  const readiness = await readIssuerVaultReadiness(
    {
      vaultAddress: asset.vaultAddress,
      contractAddress: asset.contractAddress,
      chainId: asset.chainId
    } as AdminAssetRecord,
    treasury
  );

  if (!readiness.hasShares) {
    return { ok: false, reason: `Treasury ${treasury} no tiene vault shares.` };
  }

  if (!readiness.kycApproved) {
    return { ok: false, reason: `Treasury ${treasury} sin KYC aprobado en el token.` };
  }

  return { ok: true, treasury };
}
