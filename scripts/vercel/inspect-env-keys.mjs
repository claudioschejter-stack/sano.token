#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const file = process.argv[2] || join(root, '.env.vercel.check');

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

const keys = [
  'LOCAL_RAILS_ENABLED',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'MERCADOPAGO_ACCESS_TOKEN',
  'MERCADOPAGO_WEBHOOK_SECRET',
  'DLOCAL_API_KEY',
  'EBANX_API_KEY',
  'ASTROPAY_API_KEY',
  'WISE_API_KEY',
  'BINANCE_PAY_API_KEY',
  'BRIDGE_API_KEY',
  'TRANSAK_API_KEY',
  'COINBASE_COMMERCE_API_KEY',
  'BASE_STABLECOIN_TREASURY_ADDRESS',
  'BASE_USDC_TOKEN_ADDRESS',
  'DLOCAL_DEFAULT_COUNTRY',
  'DLOCAL_CHECKOUT_BASE_URL'
];

const env = parseEnvFile(file);
console.log(`File: ${file}\n`);
for (const key of keys) {
  const val = env[key]?.trim() ?? '';
  const status = !val ? 'empty' : val === 'false' || val === '0' ? `set:${val}` : 'set';
  console.log(`${key}: ${status}`);
}
