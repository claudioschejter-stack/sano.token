#!/usr/bin/env node
/**
 * Configura variables de pasarela en Vercel Production (+ Preview).
 * - Aplica defaults de treasury/mainnet USDC
 * - Activa LOCAL_RAILS_ENABLED si no hay agregadores reales (demo AR: Modo, Brubank, etc.)
 * - Sincroniza claves presentes en .env local
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluatePaymentEnv, PAYMENT_ENV_GROUPS } from './paymentEnvCatalog.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const web = join(root, 'apps/web');

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

const rawEnv = {
  ...parseEnvFile(join(root, '.env')),
  ...parseEnvFile(join(root, '.env.local')),
  ...parseEnvFile(join(web, '.env.local'))
};

const hasRealAggregator = [
  'STRIPE_SECRET_KEY',
  'MERCADOPAGO_ACCESS_TOKEN',
  'DLOCAL_API_KEY',
  'EBANX_API_KEY',
  'ASTROPAY_API_KEY'
].some((key) => Boolean(rawEnv[key]?.trim()));

if (!hasRealAggregator) {
  rawEnv.LOCAL_RAILS_ENABLED = 'true';
  console.log('No hay agregadores reales en .env → LOCAL_RAILS_ENABLED=true (rails AR/LATAM en modo demo).');
}

const { env, productionReady, hasAnyGateway, networksReady } = evaluatePaymentEnv(rawEnv);

const extraKeys = [
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
  'STABLECOIN_CUSTODIAL_WALLET_ADDRESS'
];

const keys = [...new Set([...PAYMENT_ENV_GROUPS.flatMap((g) => g.keys), ...extraKeys])];

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

console.log('=== Configurando pasarela en Vercel ===\n');
console.log(`Redes listas (local): ${networksReady.join(', ') || 'ninguna'}`);
console.log(`Gateway configurado (local): ${hasAnyGateway ? 'sí' : 'no'}`);
console.log(`Operativo mínimo (local): ${productionReady ? 'sí' : 'no'}\n`);

let ok = 0;
let skipped = 0;
let failed = 0;

for (const name of keys) {
  const result = setEnv(name, env[name]);
  if (result === 'ok') ok += 1;
  else if (result === 'failed') failed += 1;
  else skipped += 1;
}

console.log(`\nResumen: ok=${ok} skipped=${skipped} failed=${failed}`);

if (failed > 0) {
  process.exit(1);
}

console.log('\nSiguiente: redeploy production');
console.log('  cd apps/web && npx vercel --prod --yes');
console.log('Verificar en runtime:');
console.log('  npx vercel env run production node scripts/vercel/check-payments-env.mjs');
