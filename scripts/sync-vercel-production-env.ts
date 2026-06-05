#!/usr/bin/env node
/**
 * Sincroniza variables críticas de emisión RWA/Morpho desde .env local → Vercel production.
 * Uso: npx tsx scripts/sync-vercel-production-env.ts
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const WEB = resolve(ROOT, 'apps/web');

const SYNC_KEYS = [
  'BASE_RPC_URL',
  'LENDING_BASE_RPC_URL',
  'LENDING_CHAIN_ID',
  'LENDING_ONCHAIN_RATES',
  'LENDING_RATES_CACHE_TTL_MINUTES',
  'MORPHO_CHAIN_ID',
  'MORPHO_DEFAULT_LLTV_BPS',
  'MORPHO_SEED_LIQUIDITY_USDC',
  'TOKEN_DEPLOY_CHAIN_ID',
  'TOKEN_DEPLOY_PRIVATE_KEY',
  'TOKEN_TREASURY_ADDRESS',
  'NEXT_PUBLIC_TOKEN_TREASURY_ADDRESS',
  'TREASURY_OWNER_PRIVATE_KEY',
  'NEXT_PUBLIC_CHAIN_ID',
  'AUTOMATION_DISABLED',
  'AUTOMATION_TX_CONFIRMATIONS',
  'RWA_OPERATOR_ADDRESS',
  'RWA_ALLOWED_EXTERNAL_CONTRACTS',
  'RWA_SYNTHETIC_ENABLED',
  'RWA_SYNTHETIC_ALLOWED_CHAIN_IDS',
  'RWA_DAILY_WITHDRAWAL_LIMIT_BPS',
  'RWA_MAX_DAILY_BORROW_USD',
  'RWA_BORROW_SAFETY_BPS',
  'STABLECOIN_DEFAULT_NETWORK',
  'STABLECOIN_ENABLED_NETWORKS',
  'STABLECOIN_CHAIN_ID',
  'STABLECOIN_TREASURY_ADDRESS',
  'BASE_STABLECOIN_CHAIN_ID',
  'BASE_USDC_TOKEN_ADDRESS',
  'BASE_STABLECOIN_TREASURY_ADDRESS',
  'USDC_DECIMALS',
  'NEXT_PUBLIC_SITE_URL'
] as const;

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const map: Record<string, string> = {};

  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map[key] = value;
  }

  return map;
}

function shouldSkip(value: string | undefined): boolean {
  if (!value?.trim()) return true;
  if (value.includes('YOUR-PASSWORD')) return true;
  if (value.includes('change-me')) return true;
  return false;
}

function setVercelEnv(key: string, value: string) {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(
    npx,
    ['vercel', 'env', 'add', key, 'production', '--force', '--yes'],
    {
      cwd: WEB,
      input: value,
      stdio: ['pipe', 'inherit', 'inherit'],
      env: process.env,
      shell: process.platform === 'win32'
    }
  );

  if (result.status !== 0) {
    throw new Error(`Failed to set ${key} (exit ${result.status ?? 'unknown'})`);
  }
}

function mergeEnv(...files: string[]): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const file of files) {
    for (const [key, value] of Object.entries(parseEnvFile(file))) {
      if (value.trim()) {
        merged[key] = value;
      }
    }
  }
  return merged;
}

function main() {
  const env = mergeEnv(
    resolve(ROOT, '.env'),
    resolve(ROOT, '.env.local'),
    resolve(WEB, '.env.local')
  );

  if (!env.MORPHO_SEED_LIQUIDITY_USDC?.trim()) {
    env.MORPHO_SEED_LIQUIDITY_USDC = '0';
  }

  if (!env.NEXT_PUBLIC_CHAIN_ID?.trim() && env.TOKEN_DEPLOY_CHAIN_ID?.trim()) {
    env.NEXT_PUBLIC_CHAIN_ID = env.TOKEN_DEPLOY_CHAIN_ID;
  }

  if (!env.NEXT_PUBLIC_TOKEN_TREASURY_ADDRESS?.trim() && env.TOKEN_TREASURY_ADDRESS?.trim()) {
    env.NEXT_PUBLIC_TOKEN_TREASURY_ADDRESS = env.TOKEN_TREASURY_ADDRESS;
  }

  if (!env.TREASURY_OWNER_PRIVATE_KEY?.trim() && env.TOKEN_DEPLOY_PRIVATE_KEY?.trim()) {
    env.TREASURY_OWNER_PRIVATE_KEY = env.TOKEN_DEPLOY_PRIVATE_KEY;
    console.log(
      '[sync] TREASURY_OWNER_PRIVATE_KEY no definida localmente; usando TOKEN_DEPLOY_PRIVATE_KEY (reemplazá si el owner del Safe es otra wallet).'
    );
  }

  let updated = 0;
  let skipped = 0;

  for (const key of SYNC_KEYS) {
    const value = env[key];
    if (shouldSkip(value)) {
      console.log(`[skip] ${key}`);
      skipped += 1;
      continue;
    }

    console.log(`[set] ${key}`);
    setVercelEnv(key, value!);
    updated += 1;
  }

  console.log(`\nDone. updated=${updated} skipped=${skipped}`);
  console.log('Redeploy production para aplicar: cd apps/web && npx vercel --prod');
}

main();
