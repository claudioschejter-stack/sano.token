/**
 * One-shot: re-probe Morpho liquidity for both Añelo projects and refresh DB status.
 *   npx tsx scripts/ops/refresh-morpho-both-anelo.ts
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
config({ path: resolve(root, 'packages/database/.env') });
config({ path: resolve(root, '.env') });
config({ path: resolve(root, '.env.local') });
if (process.env.DIRECT_URL?.trim()) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { getAdminAsset } from '../../apps/web/src/lib/admin/assetsService';
import { probeMorphoLiquidityStatus } from '../../apps/web/src/lib/lending/morphoLiquidityCheck';

const IDS = [
  'proj-anelo-apart-hotel-urban-view',
  'proj-apart-hotel-urban-view-anelo-mplonxbv'
];

async function main() {
  for (const id of IDS) {
    const asset = await getAdminAsset(id);
    if (!asset) {
      console.log(JSON.stringify({ id, error: 'missing' }));
      continue;
    }
    const morpho = asset.collateralTargets.find((t) => t.protocol === 'MORPHO');
    const before = {
      morphoLiquidityStatus: asset.morphoLiquidityStatus,
      readyToBorrow: asset.readyToBorrow,
      vaultFundingStatus: asset.vaultFundingStatus,
      morphoStatus: morpho?.status,
      hasOracle: Boolean(morpho?.oracleAddress),
      isActive: asset.isActive
    };
    const probe = await probeMorphoLiquidityStatus(asset);
    const after = await getAdminAsset(id);
    console.log(
      JSON.stringify(
        {
          id,
          title: asset.title,
          before,
          probe,
          after: {
            morphoLiquidityStatus: after?.morphoLiquidityStatus,
            readyToBorrow: after?.readyToBorrow
          }
        },
        null,
        2
      )
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
