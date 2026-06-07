#!/usr/bin/env node
/**
 * Configura emisión RWA + Morpho en Plume mainnet (chain 98866) en Vercel Production.
 * No sobrescribe TOKEN_DEPLOY_PRIVATE_KEY ni TOKEN_TREASURY_ADDRESS si están vacíos en defaults.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const web = join(root, 'apps/web');

/** Native USDC on Plume mainnet — Circle / Plume docs */
const PLUME_NATIVE_USDC = '0x222365EF19F7947e5484218551B56bb3965Aa7aF';
const PLUME_CHAIN_ID = '98866';

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
    if (val.trim()) out[key] = val;
  }
  return out;
}

const local = {
  ...parseEnvFile(join(root, '.env')),
  ...parseEnvFile(join(root, '.env.local')),
  ...parseEnvFile(join(web, '.env.local'))
};

const defaults = {
  TOKEN_DEPLOY_CHAIN_ID: PLUME_CHAIN_ID,
  MORPHO_CHAIN_ID: PLUME_CHAIN_ID,
  LENDING_CHAIN_ID: PLUME_CHAIN_ID,
  NEXT_PUBLIC_CHAIN_ID: PLUME_CHAIN_ID,
  PLUME_RPC_URL: 'https://rpc.plume.org',
  NEXT_PUBLIC_PLUME_RPC_URL: 'https://rpc.plume.org',
  NEXT_PUBLIC_PLUME_ENABLED: 'true',
  PLUME_USDC_TOKEN_ADDRESS: PLUME_NATIVE_USDC,
  NEXT_PUBLIC_PLUME_USDC_TOKEN_ADDRESS: PLUME_NATIVE_USDC,
  MORPHO_PLUME_ADDRESS: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
  MORPHO_PLUME_IRM_ADDRESS: '0x46415998764c29ab2a25cbea6254146d50d22687',
  MORPHO_PLUME_LLTV_BPS: '6250',
  MORPHO_DEFAULT_LLTV_BPS: '6250'
};

const vars = { ...defaults };
for (const [key, value] of Object.entries(local)) {
  if (value?.trim()) vars[key] = value.trim();
}

const includePreview = process.argv.includes('--preview');

function setEnv(name, value, environments = includePreview ? ['production', 'preview'] : ['production']) {
  if (!value?.trim()) {
    console.log(`skip ${name} (empty)`);
    return 'skipped';
  }

  let hadFailure = false;
  for (const target of environments) {
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const result = spawnSync(npx, ['vercel', 'env', 'add', name, target, '--force', '--yes'], {
      cwd: web,
      input: value.trim(),
      encoding: 'utf8',
      shell: process.platform === 'win32'
    });
    if (result.status !== 0) {
      console.error(`failed ${name}@${target}`);
      hadFailure = true;
      continue;
    }
    console.log(`ok ${name}@${target}`);
  }
  return hadFailure ? 'failed' : 'ok';
}

const keys = [
  'TOKEN_DEPLOY_CHAIN_ID',
  'MORPHO_CHAIN_ID',
  'LENDING_CHAIN_ID',
  'NEXT_PUBLIC_CHAIN_ID',
  'PLUME_RPC_URL',
  'NEXT_PUBLIC_PLUME_RPC_URL',
  'NEXT_PUBLIC_PLUME_ENABLED',
  'PLUME_USDC_TOKEN_ADDRESS',
  'NEXT_PUBLIC_PLUME_USDC_TOKEN_ADDRESS',
  'MORPHO_PLUME_ADDRESS',
  'MORPHO_PLUME_IRM_ADDRESS',
  'MORPHO_PLUME_LLTV_BPS',
  'MORPHO_DEFAULT_LLTV_BPS',
  'TOKEN_DEPLOY_PRIVATE_KEY',
  'TOKEN_TREASURY_ADDRESS',
  'RWA_OPERATOR_ADDRESS'
];

console.log('=== Plume mainnet (98866) — Vercel Production ===\n');
console.log(`USDC nativo: ${PLUME_NATIVE_USDC}\n`);

let ok = 0;
let skipped = 0;
let failed = 0;

for (const name of keys) {
  const result = setEnv(name, vars[name]);
  if (result === 'ok') ok += 1;
  else if (result === 'failed') failed += 1;
  else skipped += 1;
}

console.log(`\nResumen: ok=${ok} skipped=${skipped} failed=${failed}`);

if (failed > 0) {
  process.exit(1);
}

if (!vars.TOKEN_DEPLOY_PRIVATE_KEY?.trim()) {
  console.log('\n⚠ Falta TOKEN_DEPLOY_PRIVATE_KEY en Vercel (wallet con PLUME para gas).');
}
if (!vars.TOKEN_TREASURY_ADDRESS?.trim()) {
  console.log('⚠ Falta TOKEN_TREASURY_ADDRESS (Safe treasury).');
}

console.log('\nSiguiente: redeploy production');
console.log('  cd apps/web && npx vercel --prod --yes');
