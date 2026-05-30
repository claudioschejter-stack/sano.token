import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../packages/database/.env') });
config({ path: resolve(__dirname, '../.env') });
if (process.env.DIRECT_URL?.trim()) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { distributeUsdcToProjectVault } from '../apps/web/src/lib/yield/yieldVaultDistribution';

async function main() {
  const batchId = process.argv[2]?.trim();
  if (!batchId) {
    console.error('Usage: npx tsx scripts/distribute-yield-batch.ts <batchId>');
    process.exit(1);
  }

  const batch = await distributeUsdcToProjectVault(batchId);
  console.log(
    JSON.stringify(
      {
        ok: true,
        batchId: batch.id,
        projectId: batch.projectId,
        status: batch.status,
        usdcAmount: batch.usdcAmount?.toString() ?? null,
        distributionTxHash: batch.distributionTxHash
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error('[distribute-yield-batch]', error);
  process.exit(1);
});
