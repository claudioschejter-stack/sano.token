#!/usr/bin/env node
/**
 * Smoke check: USDC on-chain checkout prerequisites (local .env or CI).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluatePaymentEnv } from './vercel/paymentEnvCatalog.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sano-token-web.vercel.app';
const mainnetProjectId = 'proj-apart-hotel-urban-view-anelo-mplonxbv';

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

const report = evaluatePaymentEnv({
  ...parseEnvFile(join(root, '.env')),
  ...parseEnvFile(join(root, 'apps/web/.env.local'))
});

const baseReady = report.networksReady.includes('BASE');
const treasury = report.env.BASE_STABLECOIN_TREASURY_ADDRESS;
const usdc = report.env.BASE_USDC_TOKEN_ADDRESS;
const chainId = report.env.BASE_STABLECOIN_CHAIN_ID || '8453';

console.log('=== A — USDC checkout readiness ===\n');
console.log(`Site: ${siteUrl}`);
console.log(`Project: ${mainnetProjectId}`);
console.log(`Checkout URL: ${siteUrl}/marketplace/${mainnetProjectId}/checkout\n`);

console.log('Backend config:');
console.log(`  ${baseReady ? '✓' : '✗'} BASE stablecoin network configured`);
console.log(`  ${treasury ? '✓' : '✗'} Treasury: ${treasury || '(missing)'}`);
console.log(`  ${usdc ? '✓' : '✗'} USDC token: ${usdc || '(missing)'}`);
console.log(`  ✓ Chain ID: ${chainId} (Base mainnet)\n`);

if (!baseReady) {
  console.error('BLOCKED: configure BASE treasury + USDC in Vercel, then redeploy.');
  process.exit(1);
}

console.log('Manual test (your wallet):');
console.log('  1. Login at /acceso → KYC approved');
console.log('  2. Marketplace → Apart Hotel Urban View AÑELO → Comprar');
console.log('  3. Connect Coinbase Wallet on Base (8453)');
console.log('  4. Method: USDC on-chain → confirm transfer to treasury');
console.log('  5. Wait for on-chain verify → status "done"\n');
console.log('Expected pay-to address:', treasury);
console.log('USDC contract (Base):', usdc);
