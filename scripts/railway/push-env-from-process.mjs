#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, renameSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function withoutLocalEnvOverrides(run) {
  const backups = [];
  for (const name of ['.env', '.env.local', 'apps/web/.env.local']) {
    const path = join(root, name);
    if (!existsSync(path)) continue;
    const backup = `${path}.railway-bak`;
    renameSync(path, backup);
    backups.push([path, backup]);
  }
  try {
    return run();
  } finally {
    for (const [path, backup] of backups) {
      renameSync(backup, path);
    }
  }
}

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

const dbEnv = parseEnvFile(join(root, 'packages/database/.env'));

const staticVars = {
  FRONTEND_ORIGINS:
    'https://www.sanovacapital.com,https://sanovacapital.com,https://sano-token-web.vercel.app',
  BLOCKCHAIN_LISTENER_ENABLED: 'true',
  BLOCKCHAIN_WRITES_ENABLED: 'false',
  BULL_ENABLED: 'false',
  BLOCKCHAIN_RPC_URL: process.env.BLOCKCHAIN_RPC_URL || process.env.BASE_RPC_URL || 'https://mainnet.base.org'
};

const fromEnv = [
  'DATABASE_URL',
  'JWT_SECRET',
  'AUTH_INTERNAL_SECRET',
  'AUTH_ADMIN_EMAILS',
  'AUTH_ADMIN_PASSWORD',
  'SUMSUB_WEBHOOK_SECRET'
];

const pairs = { ...staticVars };
for (const key of fromEnv) {
  const v = process.env[key]?.trim() || dbEnv[key]?.trim();
  if (v && !v.includes('[YOUR-PASSWORD]')) pairs[key] = v;
}

function setVar(key, value) {
  if (/[=;\s]/.test(value)) {
    return spawnSync('npx', ['@railway/cli', 'variable', 'set', key, '--stdin'], {
      cwd: root,
      input: value,
      encoding: 'utf8',
      shell: true
    });
  }
  return spawnSync('npx', ['@railway/cli', 'variable', 'set', `${key}=${value}`], {
    cwd: root,
    encoding: 'utf8',
    shell: true
  });
}

function pushVars() {
  let ok = 0;
  for (const [key, value] of Object.entries(pairs)) {
    const result = setVar(key, value);
    if (result.status !== 0) {
      console.error(`failed ${key}`);
      process.exitCode = 1;
      continue;
    }
    console.log(`ok ${key}`);
    ok += 1;
  }
  console.log(`done ${ok}/${Object.keys(pairs).length}`);
}

if (process.env.VERCEL === '1' || process.env.RAILWAY_PUSH_SKIP_VERCEL_RUN === '1') {
  pushVars();
} else {
  const wrapped = withoutLocalEnvOverrides(() =>
    spawnSync(
      'npx',
      ['vercel', 'env', 'run', '--environment', 'production', '--', 'node', 'scripts/railway/push-env-from-process.mjs'],
      { cwd: root, encoding: 'utf8', shell: true, env: { ...process.env, RAILWAY_PUSH_SKIP_VERCEL_RUN: '1' } }
    )
  );
  if (wrapped.status !== 0) {
    console.error((wrapped.stderr || wrapped.stdout || '').slice(0, 500));
    process.exit(wrapped.status ?? 1);
  }
  process.stdout.write(wrapped.stdout || '');
}
