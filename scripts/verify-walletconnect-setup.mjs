#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
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

const projectId =
  process.env.NEXT_PUBLIC_WC_PROJECT_ID?.trim() ||
  parseEnvFile(join(root, '.env')).NEXT_PUBLIC_WC_PROJECT_ID?.trim() ||
  parseEnvFile(join(root, '.env.local')).NEXT_PUBLIC_WC_PROJECT_ID?.trim() ||
  parseEnvFile(join(root, 'apps/web/.env.local')).NEXT_PUBLIC_WC_PROJECT_ID?.trim() ||
  '';

console.log('=== WalletConnect / Reown setup ===\n');
console.log(`Site: ${siteUrl}`);
console.log(`Project ID: ${projectId ? `${projectId.slice(0, 8)}… (${projectId.length} chars)` : '(not set)'}\n`);

if (!projectId) {
  console.log('Status: NOT CONFIGURED\n');
  console.log('Steps:');
  console.log('  1. https://cloud.reown.com → New Project → name "Sanova Global"');
  console.log('  2. Allowed domains: sano-token-web.vercel.app, localhost:3000');
  console.log('  3. Copy Project ID → NEXT_PUBLIC_WC_PROJECT_ID in .env');
  console.log('  4. npm run vercel:sync-walletconnect && npx vercel --prod');
  process.exit(1);
}

console.log('Status: CONFIGURED (local env)\n');
console.log('Wallets enabled in checkout: Coinbase Smart Wallet + WalletConnect');
console.log('Verify in prod after deploy:');
console.log(`  ${siteUrl}/api/onboarding/integrations → walletconnect.configured: true`);
console.log(`  ${siteUrl}/marketplace → Connect → should list WalletConnect`);
process.exit(0);
