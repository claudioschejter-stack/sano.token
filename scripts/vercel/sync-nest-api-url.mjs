#!/usr/bin/env node
/**
 * Sync NEXT_PUBLIC_API_URL to Vercel (web) so SSE /api/v1/* reach the Nest worker.
 * Uses process env or the known Railway production domain — does not read .env files
 * or print secret/URL values (CodeQL clear-text / file→network hygiene).
 */
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const RAILWAY_PRODUCTION_API = 'https://sanovaapi-production.up.railway.app';

function pickApiUrl(value) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) return '';
  return trimmed.replace(/\/$/, '');
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return '(invalid)';
  }
}

const apiUrl =
  pickApiUrl(process.env.NEST_PUBLIC_API_URL) ||
  pickApiUrl(process.env.NEST_API_URL) ||
  pickApiUrl(process.env.NEXT_PUBLIC_API_URL) ||
  RAILWAY_PRODUCTION_API;

function addEnv(name, value, environments = ['production', 'preview', 'development']) {
  if (!value) {
    console.log(`skip ${name} (export NEXT_PUBLIC_API_URL or NEST_PUBLIC_API_URL first)`);
    return false;
  }
  let allOk = true;
  for (const target of environments) {
    const result = spawnSync(
      'npx',
      ['vercel', 'env', 'add', name, target, '--value', value, '--force', '--yes'],
      { cwd: root, encoding: 'utf8', shell: true }
    );
    if (result.status !== 0) {
      console.error(`failed ${name}@${target}`);
      allOk = false;
      continue;
    }
    console.log(`ok ${name}@${target} (host ${safeHost(value)})`);
  }
  return allOk;
}

console.log('=== Sync Nest API URL → Vercel (web rewrites + browser SSE) ===\n');
console.log(`Target host: ${safeHost(apiUrl)}`);
const ok = addEnv('NEXT_PUBLIC_API_URL', apiUrl);
if (!ok) {
  console.error('\nSync failed. Authenticate Vercel CLI (`npx vercel login`) or set VERCEL_TOKEN.');
  process.exitCode = 1;
} else {
  console.log('\nNest worker must be reachable at this host (Docker/Railway/Fly).');
  console.log('Redeploy web so the client bundle picks up NEXT_PUBLIC_API_URL.');
  console.log('Verify: npm run vercel:verify-nest');
}
