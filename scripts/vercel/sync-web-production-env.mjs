#!/usr/bin/env node
/**
 * Sync critical production env vars for Vercel web (API URL, WebAuthn, site URL).
 */
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const RAILWAY_API = 'https://sanovaapi-production.up.railway.app';
const PRODUCTION_SITE = 'https://www.sanovacapital.com';

const entries = {
  NEXT_PUBLIC_API_URL: RAILWAY_API,
  NEXT_PUBLIC_SITE_URL: PRODUCTION_SITE,
  WEBAUTHN_RP_ID: 'sanovacapital.com',
  WEBAUTHN_ORIGIN: PRODUCTION_SITE,
  FRONTEND_ORIGINS:
    'https://www.sanovacapital.com,https://sanovacapital.com,https://sano-token-web.vercel.app',
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN: 'sanovacapital.com',
  NEXT_PUBLIC_TOKEN_TREASURY_ADDRESS: '0x5e7480c43f99cBCc90550a16356C90793c300d52'
};

function addEnv(name, value, environments = ['production', 'development']) {
  for (const target of environments) {
    const result = spawnSync(
      npxCmd,
      ['vercel', 'env', 'add', name, target, '--value', value, '--force', '--yes'],
      { cwd: root, encoding: 'utf8' }
    );
    if (result.status !== 0) {
      console.error(`failed ${name}@${target}:`, (result.stderr || result.stdout || '').slice(0, 300));
      return false;
    }
    console.log(`ok ${name}@${target}`);
  }
  return true;
}

console.log('=== Sync Vercel web production env ===\n');
for (const [name, value] of Object.entries(entries)) {
  addEnv(name, value);
}
