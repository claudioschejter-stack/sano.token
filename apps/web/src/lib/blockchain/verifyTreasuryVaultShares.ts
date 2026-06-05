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
