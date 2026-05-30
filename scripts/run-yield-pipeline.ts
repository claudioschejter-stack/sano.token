import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../packages/database/.env') });
config({ path: resolve(__dirname, '../.env') });
if (process.env.DIRECT_URL?.trim()) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { autoEnqueueEligibleYieldBatches, processDueYieldBatches } from '../apps/web/src/lib/yield/yieldJobProcessor';

async function main() {
  const enqueueOnly = process.argv.includes('--enqueue-only');
  const processOnly = process.argv.includes('--process-only');

  let enqueued: Awaited<ReturnType<typeof autoEnqueueEligibleYieldBatches>> = [];
  if (!processOnly) {
    enqueued = await autoEnqueueEligibleYieldBatches();
    console.log('[yield-pipeline] enqueued', JSON.stringify(enqueued, null, 2));
  }

  if (!enqueueOnly) {
    const jobRun = await processDueYieldBatches(15);
    console.log('[yield-pipeline] jobs', JSON.stringify(jobRun, null, 2));
  }
}

main().catch((error) => {
  console.error('[run-yield-pipeline]', error);
  process.exit(1);
});
