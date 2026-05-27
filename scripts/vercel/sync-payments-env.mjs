#!/usr/bin/env node
/**
 * Sync payment/wallet env vars to Vercel (Production + Preview).
 * Applies treasury fallbacks and mainnet USDC defaults before sync.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluatePaymentEnv, PAYMENT_ENV_GROUPS } from './paymentEnvCatalog.mjs';

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

const rawEnv = {
  ...parseEnvFile(join(root, '.env')),
  ...parseEnvFile(join(root, 'apps/web/.env.local'))
};

const { env } = evaluatePaymentEnv(rawEnv);

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

const keys = [...new Set(PAYMENT_ENV_GROUPS.flatMap((group) => group.keys))];
keys.push(
  'STABLECOIN_TREASURY_ADDRESS',
  'STABLECOIN_DEFAULT_NETWORK',
  'STABLECOIN_ENABLED_NETWORKS',
  'STABLECOIN_CHAIN_ID',
  'USDC_TOKEN_ADDRESS',
  'USDC_DECIMALS',
  'PAYMENT_MANUAL_REVIEW_RISK_SCORE',
  'PAYMENT_HIGH_RISK_AMOUNT_USD',
  'PAYMENT_CIRCUIT_BREAKER_FAILURES',
  'PAYMENT_CIRCUIT_BREAKER_WINDOW_MINUTES',
  'RAMP_API_KEY',
  'RAMP_WEBHOOK_SECRET'
);

console.log('Syncing payment/wallet env vars to Vercel…');
for (const name of keys) {
  addEnv(name, env[name]);
}
console.log('Done. Redeploy production for vars to take effect.');
