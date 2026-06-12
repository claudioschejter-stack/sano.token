#!/usr/bin/env node
/**
 * Push Nest worker env vars to Railway from .env (never logs secret values).
 * Requires: npx @railway/cli linked to the API service, or RAILWAY_TOKEN.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

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
  ...parseEnvFile(join(root, '.env.railway'))
};

const NEST_KEYS = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'JWT_SECRET',
  'AUTH_INTERNAL_SECRET',
  'AUTH_ADMIN_EMAILS',
  'AUTH_ADMIN_PASSWORD',
  'FRONTEND_ORIGINS',
  'BLOCKCHAIN_LISTENER_ENABLED',
  'BLOCKCHAIN_WRITES_ENABLED',
  'BLOCKCHAIN_RPC_URL',
  'BASE_RPC_URL',
  'SUMSUB_WEBHOOK_SECRET',
  'REDIS_URL',
  'BULL_ENABLED'
];

const values = {
  NODE_ENV: 'production',
  PORT: '3001',
  FRONTEND_ORIGINS:
    'https://www.sanovacapital.com,https://sanovacapital.com,https://sano-token-web.vercel.app',
  BLOCKCHAIN_LISTENER_ENABLED: 'true',
  BLOCKCHAIN_WRITES_ENABLED: 'false',
  BULL_ENABLED: env.BULL_ENABLED?.trim() || 'false'
};

for (const key of NEST_KEYS) {
  if (values[key] !== undefined) continue;
  const v = env[key]?.trim();
  if (v) values[key] = v;
}

if (!values.BLOCKCHAIN_RPC_URL && env.BASE_RPC_URL?.trim()) {
  values.BLOCKCHAIN_RPC_URL = env.BASE_RPC_URL.trim();
}
if (!values.BLOCKCHAIN_RPC_URL) {
  values.BLOCKCHAIN_RPC_URL = 'https://mainnet.base.org';
}

console.log('=== Sync Nest env → Railway ===\n');

let ok = 0;
let skip = 0;
for (const [key, value] of Object.entries(values)) {
  if (!value || value.includes('[YOUR-PASSWORD]')) {
    console.log(`skip ${key} (missing or placeholder)`);
    skip += 1;
    continue;
  }
  const result = spawnSync('npx', ['@railway/cli', 'variables', 'set', `${key}=${value}`], {
    cwd: root,
    encoding: 'utf8',
    shell: true
  });
  if (result.status !== 0) {
    console.error(`failed ${key}:`, (result.stderr || result.stdout || '').slice(0, 200));
    process.exitCode = 1;
    continue;
  }
  console.log(`ok ${key}`);
  ok += 1;
}

console.log(`\n${ok} set, ${skip} skipped.`);
