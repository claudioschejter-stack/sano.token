#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

async function main() {
  process.env.BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://1rpc.io/base';
  process.env.LENDING_BASE_RPC_URL = process.env.LENDING_BASE_RPC_URL || process.env.BASE_RPC_URL;

  const { migrateTreasuryFromLegacySafe } = await import(
    '../../apps/web/src/lib/blockchain/migrateTreasuryFromLegacySafe.ts'
  );
  const result = await migrateTreasuryFromLegacySafe();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok && !result.skipped && result.reason !== 'ALLOWLIST_TIMELOCK_PENDING') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
