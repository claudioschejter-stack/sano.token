#!/usr/bin/env node
/**
 * Lista lo que el operador debe configurar manualmente (API keys, webhooks).
 */
import { evaluatePaymentEnv, PAYMENT_ENV_GROUPS, WEBHOOK_PATHS } from './paymentEnvCatalog.mjs';
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
    if (val.trim()) out[key] = val;
  }
  return out;
}

const env = evaluatePaymentEnv({
  ...parseEnvFile(join(root, '.env')),
  ...parseEnvFile(join(root, '.env.local')),
  ...parseEnvFile(join(root, 'apps/web/.env.local')),
  LOCAL_RAILS_ENABLED: process.env.LOCAL_RAILS_ENABLED || 'true'
}).env;

console.log('=== Tareas manuales — Pasarela Sanova ===\n');

const priority = [
  { id: 'stripe', label: 'Stripe (tarjetas, Apple/Google Pay)', keys: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] },
  { id: 'mercadopago', label: 'Mercado Pago Argentina', keys: ['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET'] },
  { id: 'dlocal', label: 'dLocal (Modo, bancos AR, Pix)', keys: ['DLOCAL_API_KEY'] },
  { id: 'astropay', label: 'AstroPay (wallets LATAM)', keys: ['ASTROPAY_API_KEY'] },
  { id: 'bridge', label: 'Bridge / Wise internacional', keys: ['BRIDGE_API_KEY', 'WISE_API_KEY'] },
  { id: 'transak', label: 'Transak on-ramp global', keys: ['TRANSAK_API_KEY', 'TRANSAK_WEBHOOK_SECRET'] }
];

for (const item of priority) {
  const missing = item.keys.filter((key) => !env[key]?.trim());
  const icon = missing.length === 0 ? '✓' : '○';
  console.log(`${icon} ${item.label}`);
  if (missing.length > 0) {
    for (const key of missing) {
      console.log(`    → agregar ${key} en .env y correr: npm run vercel:configure-payments`);
    }
  }
}

console.log('\nWebhooks (copiar en cada panel de proveedor):');
for (const [name, path] of Object.entries(WEBHOOK_PATHS)) {
  console.log(`  ${name}: ${siteUrl.replace(/\/$/, '')}${path}`);
}

console.log('\nVerificación producción:');
console.log(`  ${siteUrl.replace(/\/$/, '')}/api/payments/health`);
