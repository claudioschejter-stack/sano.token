import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Wallet } from 'ethers';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readEnvFile(path) {
  const values = {};
  if (!existsSync(path)) return values;

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [rawKey, ...rest] = trimmed.split('=');
    if (!rawKey || rest.length === 0) continue;
    let val = rest.join('=').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    values[rawKey.trim()] = val;
  }

  return values;
}

function pickEnv(...paths) {
  const merged = {};
  for (const path of paths) {
    Object.assign(merged, readEnvFile(path));
  }
  return merged;
}

const env = pickEnv(
  join(root, '.env'),
  join(root, 'apps/web/.env.local'),
  join(root, 'apps/web/.env')
);

const privateKey = env.TOKEN_DEPLOY_PRIVATE_KEY?.trim() || env.PRIVATE_KEY?.trim() || null;
const deployerAddress = privateKey ? new Wallet(privateKey).address : null;

const rows = [
  ['TOKEN_TREASURY_ADDRESS', env.TOKEN_TREASURY_ADDRESS ?? env.SANOVA_TREASURY_ADDRESS ?? ''],
  ['RWA_OPERATOR_ADDRESS', env.RWA_OPERATOR_ADDRESS ?? ''],
  ['BASE_STABLECOIN_TREASURY_ADDRESS', env.BASE_STABLECOIN_TREASURY_ADDRESS ?? env.STABLECOIN_TREASURY_ADDRESS ?? ''],
  ['Deployer (from TOKEN_DEPLOY_PRIVATE_KEY)', deployerAddress ?? '']
];

console.log('');
console.log('=== Platform wallet env (copy to Vercel) ===');
console.log('');

for (const [label, value] of rows) {
  console.log(`${label}=${value || '(not set)'}`);
}

console.log('');
console.log('Chain: Base mainnet (8453) unless MORPHO_CHAIN_ID overrides.');
console.log('');
