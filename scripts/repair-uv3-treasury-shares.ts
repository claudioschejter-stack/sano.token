#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: resolve(root, 'packages/database/.env') });
config({ path: resolve(root, '.env') });
config({ path: resolve(root, 'apps/web/.env.local') });

import { getAdminAsset } from '../apps/web/src/lib/admin/assetsService';
import { repairTreasuryVaultShares } from '../apps/web/src/lib/blockchain/repairTreasuryVaultShares';

const PROJECT_ID = 'proj-anelo-apart-hotel-urban-view';

async function main() {
  const asset = await getAdminAsset(PROJECT_ID);
  if (!asset) throw new Error('asset missing');
  console.log(await repairTreasuryVaultShares(asset));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
