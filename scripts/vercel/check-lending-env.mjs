#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sano-token-web.vercel.app';

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

const required = [
  { key: 'LENDING_BASE_RPC_URL', label: 'RPC Base mainnet (tasas on-chain)', fallback: 'BASE_RPC_URL' },
  { key: 'LENDING_ONCHAIN_RATES', label: 'Lectura on-chain activada' },
  { key: 'LENDING_CHAIN_ID', label: 'Chain ID para tasas (8453 = Base mainnet)' },
  { key: 'LENDING_RATES_CACHE_TTL_MINUTES', label: 'TTL cache de tasas' },
  { key: 'CRON_SECRET', label: 'Secret del cron diario (Vercel)' }
];

console.log('=== Sanova — Tasas de préstamo (Capa 1) ===\n');
console.log(`Sitio: ${siteUrl}`);
console.log(`Cron: ${siteUrl}/api/cron/refresh-borrow-rates\n`);

let ready = true;
for (const item of required) {
  const value = (env[item.key] || (item.fallback ? env[item.fallback] : ''))?.trim();
  const ok = Boolean(value);
  if (!ok) ready = false;
  console.log(`${ok ? '✓' : '✗'} ${item.label}`);
  console.log(`    ${item.key}${value ? ` = ${item.key === 'CRON_SECRET' ? '(configurado)' : value}` : ' (vacío)'}`);
}

console.log('\nOverrides APY opcionales (si vacíos → DefiLlama / defaults):');
for (const key of ['AAVE_BORROW_APY_BPS', 'MORPHO_BORROW_APY_BPS', 'COMPOUND_BORROW_APY_BPS', 'MAKER_BORROW_APY_BPS']) {
  const value = env[key]?.trim();
  console.log(`  ${value ? '✓' : '·'} ${key}${value ? ` = ${value}` : ''}`);
}

console.log(`\nCapa 1 lista para producción: ${ready ? 'SÍ' : 'NO'}`);

if (ready) {
  try {
    const response = await fetch('https://yields.llama.fi/pools', { signal: AbortSignal.timeout(15000) });
    console.log(`DefiLlama reachable: ${response.ok ? 'SÍ' : `HTTP ${response.status}`}`);
  } catch (error) {
    console.log(`DefiLlama reachable: NO (${error instanceof Error ? error.message : 'error'})`);
  }
}

console.log('\nComandos:');
console.log('  npm run vercel:sync-lending   # subir vars a Vercel');
console.log('  Redeploy production           # aplicar vars en sano-token-web.vercel.app');

process.exit(ready ? 0 : 1);
