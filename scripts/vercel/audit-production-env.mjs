#!/usr/bin/env node
/**
 * Audita variables críticas en Vercel Production (solo presencia, no valores).
 * Uso: node scripts/vercel/audit-production-env.mjs
 */
import { execSync } from 'node:child_process';

const CRITICAL = [
  { group: 'Postgres (Prisma)', keys: ['DATABASE_URL', 'DIRECT_URL'] },
  {
    group: 'Auth / TOTP',
    keys: [
      'AUTH_SECRET',
      'AUTH_INTERNAL_SECRET',
      'JWT_SECRET',
      'TOTP_ENCRYPTION_KEY',
      'TOTP_ISSUER',
      'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
      'TURNSTILE_SECRET_KEY',
      'INVESTOR_OPEN_REGISTRATION'
    ]
  },
  {
    group: 'Privy',
    keys: ['NEXT_PUBLIC_PRIVY_APP_ID', 'NEXT_PUBLIC_PRIVY_CUSTOM_AUTH', 'PRIVY_APP_SECRET']
  },
  {
    group: 'Didit KYC',
    keys: ['DIDIT_API_KEY', 'DIDIT_WORKFLOW_ID', 'DIDIT_WEBHOOK_SECRET']
  },
  {
    group: 'WebAuthn (PWA)',
    keys: ['WEBAUTHN_RP_ID', 'WEBAUTHN_ORIGIN']
  },
  {
    group: 'Supabase Storage',
    keys: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET']
  },
  {
    group: 'Email',
    keys: ['RESEND_API_KEY', 'ONBOARDING_FROM_EMAIL']
  },
  {
    group: 'URLs',
    keys: ['AUTH_URL', 'NEXT_PUBLIC_SITE_URL']
  }
];

const RECOMMENDED = [
  { group: 'Pagos AR', keys: ['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET', 'NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY', 'MODO_WEBHOOK_SECRET'] },
  { group: 'Ops', keys: ['CRON_SECRET', 'BASE_RPC_URL'] }
];

function fetchProductionEnvNames() {
  const cwd = new URL('../../apps/web', import.meta.url);
  const raw = execSync('npx vercel env ls production', {
    cwd: cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const names = new Set();
  for (const line of raw.split('\n')) {
    const match = line.match(/^\s+([A-Z0-9_]+)\s+/);
    if (match) names.add(match[1]);
  }
  return names;
}

function auditGroup(groups, present) {
  let allOk = true;
  for (const { group, keys } of groups) {
    console.log(`\n${group}:`);
    for (const key of keys) {
      const ok = present.has(key);
      console.log(`  ${ok ? '✓' : '✗'} ${key}`);
      if (!ok) allOk = false;
    }
  }
  return allOk;
}

console.log('=== Vercel Production — auditoría de env vars ===');
console.log('Proyecto: claudioschejter-6194s-projects/sano-token-web\n');

const present = fetchProductionEnvNames();
console.log(`Variables en Production: ${present.size}`);

const criticalOk = auditGroup(CRITICAL, present);
auditGroup(RECOMMENDED, present);

const aliases = [
  ['POSTGRES_PRISMA_URL', 'DATABASE_URL (alias Supabase)'],
  ['POSTGRES_URL_NON_POOLING', 'DIRECT_URL (alias Supabase)']
];
console.log('\nAliases Supabase (opcionales si DATABASE_URL/DIRECT_URL están set):');
for (const [key, label] of aliases) {
  console.log(`  ${present.has(key) ? '✓' : '·'} ${key} — ${label}`);
}

console.log('\n--- Resumen ---');
console.log(criticalOk ? 'CRÍTICAS: OK (todas presentes)' : 'CRÍTICAS: FALTAN variables — ver ✗ arriba');

process.exit(criticalOk ? 0 : 1);
