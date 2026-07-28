#!/usr/bin/env node
/**
 * Verify Nest worker reachability + NEXT_PUBLIC_API_URL wiring.
 * Does not mutate Vercel/Railway — safe for CI and local ops checks.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const RAILWAY_PRODUCTION_API = 'https://sanovaapi-production.up.railway.app';

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

function pickApiUrl() {
  const env = {
    ...parseEnvFile(join(root, '.env')),
    ...parseEnvFile(join(root, '.env.railway')),
    ...parseEnvFile(join(root, 'apps/web/.env.local')),
    ...process.env
  };
  const candidates = [env.NEST_PUBLIC_API_URL, env.NEST_API_URL, env.NEXT_PUBLIC_API_URL, RAILWAY_PRODUCTION_API];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed && !trimmed.includes('localhost') && !trimmed.includes('127.0.0.1')) {
      return trimmed.replace(/\/$/, '');
    }
  }
  return RAILWAY_PRODUCTION_API;
}

async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'SanovaVerifyNest/1.0' },
      signal: controller.signal
    });
    const body = await response.text();
    return { ok: response.ok, status: response.status, body: body.slice(0, 240) };
  } catch (error) {
    return { ok: false, status: 0, body: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

function vercelEnvPresent(name) {
  const result = spawnSync('npx', ['vercel', 'env', 'ls', 'production'], {
    cwd: root,
    encoding: 'utf8',
    shell: true,
    timeout: 12_000,
    env: { ...process.env, CI: '1' }
  });
  if (result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM') {
    return { checked: false, present: false, detail: 'vercel env ls timed out' };
  }
  if (result.status !== 0) {
    return { checked: false, present: false, detail: (result.stderr || result.stdout || '').slice(0, 200) };
  }
  const out = `${result.stdout || ''}\n${result.stderr || ''}`;
  return { checked: true, present: out.includes(name), detail: out.includes(name) ? 'listed' : 'missing' };
}

const apiUrl = pickApiUrl();
const liveUrl = `${apiUrl}/api/v1/health/live`;
const healthUrl = `${apiUrl}/api/v1/health`;

console.log('=== Verify Nest worker + NEXT_PUBLIC_API_URL ===\n');
console.log(`API origin: ${apiUrl}`);

const live = await probe(liveUrl);
console.log(`health/live: ${live.ok ? 'OK' : 'FAIL'} (${live.status}) ${live.body}`);

const health = await probe(healthUrl);
console.log(`health:      ${health.ok ? 'OK' : 'FAIL'} (${health.status}) ${health.body}`);

const vercel = vercelEnvPresent('NEXT_PUBLIC_API_URL');
if (vercel.checked) {
  console.log(`Vercel production NEXT_PUBLIC_API_URL: ${vercel.present ? 'present' : 'MISSING'}`);
} else {
  console.log(`Vercel env check skipped (CLI not authenticated): ${vercel.detail}`);
}

const failed = !live.ok;
if (failed) {
  console.error('\nNest worker is not healthy from this host.');
  console.error('If status is 429 from railway-hikari, retry from another network or redeploy:');
  console.error('  RAILWAY_TOKEN=… npm run railway:deploy-nest');
  console.error('Then sync the public URL:');
  console.error('  npm run vercel:sync-nest-api-url');
  process.exitCode = 1;
} else {
  console.log('\nNest live probe OK. Ensure NEXT_PUBLIC_API_URL is set in Vercel and redeploy web.');
}
