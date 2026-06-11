import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
config({ path: resolve(root, 'packages/database/.env') });
config({ path: resolve(root, '.env') });
if (process.env.DIRECT_URL?.trim()) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { getAdminAsset, clearAutomationFailures } from '../../apps/web/src/lib/admin/assetsService';
import { repairTreasuryVaultShares } from '../../apps/web/src/lib/blockchain/repairTreasuryVaultShares';
import { checkMorphoLiquidity } from '../../apps/web/src/lib/lending/morphoLiquidityCheck';

const PROJECT_IDS = [
  'proj-anelo-apart-hotel-urban-view',
  'proj-apart-hotel-urban-view-anelo-mplonxbv'
];

async function main() {
  for (const id of PROJECT_IDS) {
    console.log(`\n=== ${id} ===`);
    await clearAutomationFailures(id);
    const asset = await getAdminAsset(id);
    if (!asset) {
      console.log('asset not found');
      continue;
    }

    const treasuryRepair = await repairTreasuryVaultShares(asset);
    console.log('treasuryRepair:', treasuryRepair);

    const refreshed = await getAdminAsset(id);
    if (refreshed) {
      const liquidity = await checkMorphoLiquidity(refreshed);
      console.log('morphoLiquidity:', liquidity);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
