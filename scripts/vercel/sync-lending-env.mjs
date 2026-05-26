#!/usr/bin/env node
/**
 * Sync lending/blockchain env vars to Vercel (Production + Preview).
 * Reads values from repo .env — never logs secrets.
 */
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const env = {
  ...parseEnvFile(join(root, '.env')),
  ...parseEnvFile(join(root, 'apps/web/.env.local'))
};

function addEnv(name, value, environments = ['production', 'preview']) {
  if (!value?.trim()) {
    console.log(`skip ${name} (empty)`);
    return false;
  }
  for (const target of environments) {
    const result = spawnSync('npx', ['vercel', 'env', 'add', name, target, '--force'], {
      cwd: root,
      input: `${value.trim()}\n`,
      encoding: 'utf8',
      shell: true
    });
    if (result.status !== 0) {
      console.error(`failed ${name}@${target}:`, result.stderr?.slice(0, 200) || result.stdout?.slice(0, 200));
      return false;
    }
    console.log(`ok ${name}@${target}`);
  }
  return true;
}

const cronSecret =
  env.CRON_SECRET?.trim() ||
  createHash('sha256').update(randomBytes(32)).digest('hex');

const vars = [
  ['CRON_SECRET', cronSecret],
  ['BASE_RPC_URL', env.BASE_RPC_URL || 'https://mainnet.base.org'],
  ['LENDING_RATES_CACHE_TTL_MINUTES', env.LENDING_RATES_CACHE_TTL_MINUTES || '15'],
  ['LENDING_ONCHAIN_RATES', env.LENDING_ONCHAIN_RATES || 'true'],
  ['TOKEN_DEPLOY_CHAIN_ID', env.TOKEN_DEPLOY_CHAIN_ID || '8453'],
  ['TOKEN_DEPLOY_PRIVATE_KEY', env.TOKEN_DEPLOY_PRIVATE_KEY || env.PRIVATE_KEY],
  ['TOKEN_TREASURY_ADDRESS', env.TOKEN_TREASURY_ADDRESS || env.SANOVA_TREASURY_ADDRESS],
  ['AUTOMATION_TX_CONFIRMATIONS', env.AUTOMATION_TX_CONFIRMATIONS || '1'],
  ['AUTOMATION_DISABLED', env.AUTOMATION_DISABLED || 'false'],
  ['RWA_SYNTHETIC_ENABLED', env.RWA_SYNTHETIC_ENABLED || 'false'],
  ['RWA_SYNTHETIC_ALLOWED_CHAIN_IDS', env.RWA_SYNTHETIC_ALLOWED_CHAIN_IDS || '84532,80002,11155111'],
  ['RWA_SYNTHETIC_MAX_GAS_WEI', env.RWA_SYNTHETIC_MAX_GAS_WEI],
  ['RWA_DAILY_WITHDRAWAL_LIMIT_BPS', env.RWA_DAILY_WITHDRAWAL_LIMIT_BPS || '1000'],
  ['RWA_MAX_DAILY_BORROW_USD', env.RWA_MAX_DAILY_BORROW_USD || '250000'],
  ['RWA_ALLOWED_EXTERNAL_CONTRACTS', env.RWA_ALLOWED_EXTERNAL_CONTRACTS],
  ['MORPHO_DEFAULT_LLTV_BPS', env.MORPHO_DEFAULT_LLTV_BPS || '6000'],
  ['MORPHO_ORACLE_ADDRESS', env.MORPHO_ORACLE_ADDRESS],
  ['MORPHO_CURATOR_ADDRESS', env.MORPHO_CURATOR_ADDRESS],
  ['BASESCAN_API_KEY', env.BASESCAN_API_KEY]
];

console.log('Syncing env vars to Vercel…');
for (const [name, value] of vars) {
  addEnv(name, value);
}
console.log('Done. Redeploy production for vars to take effect.');
