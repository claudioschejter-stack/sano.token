#!/usr/bin/env node
/**
 * Sync NEXT_PUBLIC_API_URL to Vercel (web) so SSE /api/v1/* rewrites reach the Nest worker.
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
  ...parseEnvFile(join(root, 'apps/web/.env.local'))
};

const RAILWAY_PRODUCTION_API = 'https://sanovaapi-production.up.railway.app';

function pickApiUrl(value) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.includes('localhost')) return '';
  return trimmed;
}

const apiUrl =
  pickApiUrl(env.NEST_PUBLIC_API_URL) ||
  pickApiUrl(env.NEST_API_URL) ||
  pickApiUrl(env.NEXT_PUBLIC_API_URL) ||
  RAILWAY_PRODUCTION_API;

function addEnv(name, value, environments = ['production', 'development']) {
  if (!value) {
    console.log(`skip ${name} (set NEXT_PUBLIC_API_URL or NEST_PUBLIC_API_URL in .env)`);
    return false;
  }
  for (const target of environments) {
    const result = spawnSync(
      'npx',
      ['vercel', 'env', 'add', name, target, '--value', value, '--force', '--yes'],
      { cwd: root, encoding: 'utf8', shell: true }
    );
    if (result.status !== 0) {
      console.error(`failed ${name}@${target}:`, result.stderr?.slice(0, 300) || result.stdout?.slice(0, 300));
      return false;
    }
    console.log(`ok ${name}@${target} = ${value}`);
  }
  return true;
}

console.log('=== Sync Nest API URL → Vercel (web rewrites) ===\n');
addEnv('NEXT_PUBLIC_API_URL', apiUrl);
console.log('\nNest worker must be reachable at this URL (Docker/Railway/Fly).');
