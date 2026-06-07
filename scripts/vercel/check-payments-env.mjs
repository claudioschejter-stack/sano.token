#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluatePaymentEnv, PAYMENT_ENV_GROUPS, WEBHOOK_PATHS } from './paymentEnvCatalog.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'https://sano-token-web.vercel.app';

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

function mergeTruthyEnv(...sources) {
  const merged = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'string' && value.trim()) {
        merged[key] = value.trim();
      }
    }
  }
  return merged;
}

const env = mergeTruthyEnv(
  parseEnvFile(join(root, '.env')),
  parseEnvFile(join(root, '.env.local')),
  parseEnvFile(join(root, 'apps/web/.env.local')),
  process.env
);

const report = evaluatePaymentEnv(env);

console.log('=== Sanova — Cartera y pasarela de pagos ===\n');
console.log(`Sitio: ${siteUrl}\n`);

console.log('Redes stablecoin listas:');
for (const network of report.networksReady) {
  console.log(`  ✓ ${network}`);
}
if (report.networksReady.length === 0) {
  console.log('  ✗ Ninguna red completa (falta token + treasury)');
}

console.log(`\nPasarela mínima operativa: ${report.productionReady ? 'SÍ' : 'NO'}`);
console.log(`Algún gateway configurado: ${report.hasAnyGateway ? 'SÍ' : 'NO'}\n`);

for (const group of PAYMENT_ENV_GROUPS) {
  const done = group.keys.filter((key) => report.env[key]?.trim()).length;
  const icon = done === group.keys.length ? '✓' : done > 0 ? '~' : '✗';
  console.log(`${icon} ${group.label} (${done}/${group.keys.length})`);
  for (const key of group.keys) {
    const value = report.env[key]?.trim();
    console.log(`    ${value ? '✓' : '·'} ${key}`);
  }
}

if (report.missingRequired.length > 0) {
  console.log('\nRequeridos faltantes:');
  for (const item of report.missingRequired) {
    console.log(`  - ${item.label}: ${item.keys.join(', ')}`);
  }
}

console.log('\nWebhooks (configurar en cada proveedor):');
for (const [name, path] of Object.entries(WEBHOOK_PATHS)) {
  console.log(`  ${name}: ${siteUrl}${path}`);
}

console.log('\nComandos útiles:');
console.log('  npm run vercel:sync-payments   # subir vars desde .env a Vercel');
console.log('  npm run db:stablecoin-payments # migración tablas wallet/pagos');

process.exit(report.productionReady ? 0 : 1);
