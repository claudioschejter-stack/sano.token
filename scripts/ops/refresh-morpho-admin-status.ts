import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
config({ path: resolve(root, 'packages/database/.env') });
if (process.env.DIRECT_URL?.trim()) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { getAdminAsset } from '../../apps/web/src/lib/admin/assetsService';
import { probeMorphoLiquidityStatus } from '../../apps/web/src/lib/lending/morphoLiquidityCheck';

const PROJECT_ID = 'proj-apart-hotel-urban-view-anelo-mplonxbv';

async function main() {
  const asset = await getAdminAsset(PROJECT_ID);
  if (!asset) throw new Error('asset missing');
  const probe = await probeMorphoLiquidityStatus(asset);
  const refreshed = await getAdminAsset(PROJECT_ID);
  console.log(JSON.stringify({ probe, readyToBorrow: refreshed?.readyToBorrow, morphoLiquidityStatus: refreshed?.morphoLiquidityStatus }, null, 2));
}

main().catch(console.error);
