#!/usr/bin/env node
/**
 * Stripe test setup checklist + optional API smoke test.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sano-token-web.vercel.app';
const webhookUrl = `${siteUrl.replace(/\/$/, '')}/api/webhooks/stripe`;

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

const secretKey = env.STRIPE_SECRET_KEY?.trim();
const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();

console.log('=== B — Stripe test setup ===\n');

if (!secretKey) {
  console.log('Keys not found in .env yet. Follow these steps:\n');
  console.log('1. Create account: https://dashboard.stripe.com/register');
  console.log('2. Developers → API keys → copy Secret key (sk_test_...)');
  console.log('3. Developers → Webhooks → Add endpoint');
  console.log(`   URL: ${webhookUrl}`);
  console.log('   Events: checkout.session.completed, checkout.session.expired,');
  console.log('           payment_intent.succeeded, payment_intent.payment_failed');
  console.log('4. Copy Signing secret (whsec_...)');
  console.log('5. Add to .env (do NOT paste in chat):');
  console.log('   STRIPE_SECRET_KEY=sk_test_...');
  console.log('   STRIPE_WEBHOOK_SECRET=whsec_...');
  console.log('6. Run: npm run vercel:sync-payments && npx vercel --prod --yes');
  console.log('\nTest card: 4242 4242 4242 4242 · any future expiry · any CVC\n');
  process.exit(1);
}

console.log(`Secret key: ${secretKey.startsWith('sk_test_') ? '✓ test mode' : secretKey.startsWith('sk_live_') ? '⚠ LIVE mode' : '? unknown prefix'}`);
console.log(`Webhook secret: ${webhookSecret ? '✓ set' : '✗ missing (webhooks will fail)'}\n`);

const response = await fetch('https://api.stripe.com/v1/balance', {
  headers: { Authorization: `Bearer ${secretKey}` }
});

if (!response.ok) {
  console.error('Stripe API error:', await response.text());
  process.exit(1);
}

const balance = await response.json();
console.log('✓ Stripe API reachable');
console.log('  Available:', balance.available?.map((b) => `${b.amount / 100} ${b.currency}`).join(', ') || 'n/a');
console.log('\nWebhook URL for Stripe Dashboard:');
console.log(`  ${webhookUrl}`);
console.log('\nNext: npm run vercel:sync-payments && redeploy, then checkout with Stripe in marketplace.');

if (!webhookSecret) {
  process.exit(1);
}
