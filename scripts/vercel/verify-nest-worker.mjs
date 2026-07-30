#!/usr/bin/env node
/**
 * Verify Nest worker reachability + NEXT_PUBLIC_API_URL wiring.
 * Does not mutate Vercel/Railway — safe for CI and local ops checks.
 *
 * Intentionally does NOT read .env files (CodeQL: file data → network) and
 * does NOT print full API URLs or response bodies (CodeQL: clear-text logging).
 */
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const RAILWAY_PRODUCTION_API = 'https://sanovaapi-production.up.railway.app';

function pickApiUrl() {
  // Prefer process env only (operator export / CI / vercel env run).
  const candidates = [
    process.env.NEST_PUBLIC_API_URL,
    process.env.NEST_API_URL,
    process.env.NEXT_PUBLIC_API_URL,
    RAILWAY_PRODUCTION_API
  ];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed && !trimmed.includes('localhost') && !trimmed.includes('127.0.0.1')) {
      return trimmed.replace(/\/$/, '');
    }
  }
  return RAILWAY_PRODUCTION_API;
}

function safeOriginLabel(url) {
  try {
    const { host, protocol } = new URL(url);
    return `${protocol}//${host}`;
  } catch {
    return '(invalid-url)';
  }
}

async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'SanovaVerifyNest/1.0' },
      signal: controller.signal
    });
    // Drain body without logging contents (may include infra details).
    await response.text().catch(() => '');
    return { ok: response.ok, status: response.status };
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String(error.code) : 'fetch_error';
    return { ok: false, status: 0, errorCode: code };
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
    return { checked: false, present: false, detail: 'vercel CLI unavailable or not authenticated' };
  }
  const out = `${result.stdout || ''}\n${result.stderr || ''}`;
  return { checked: true, present: out.includes(name), detail: out.includes(name) ? 'listed' : 'missing' };
}

const apiUrl = pickApiUrl();
const originLabel = safeOriginLabel(apiUrl);
const liveUrl = `${apiUrl}/api/v1/health/live`;
const healthUrl = `${apiUrl}/api/v1/health`;

console.log('=== Verify Nest worker + NEXT_PUBLIC_API_URL ===\n');
console.log(`API origin host: ${originLabel}`);

const live = await probe(liveUrl);
console.log(
  `health/live: ${live.ok ? 'OK' : 'FAIL'} (HTTP ${live.status}${live.errorCode ? `, ${live.errorCode}` : ''})`
);

const health = await probe(healthUrl);
console.log(
  `health:      ${health.ok ? 'OK' : 'FAIL'} (HTTP ${health.status}${health.errorCode ? `, ${health.errorCode}` : ''})`
);

const vercel = vercelEnvPresent('NEXT_PUBLIC_API_URL');
if (vercel.checked) {
  console.log(`Vercel production NEXT_PUBLIC_API_URL: ${vercel.present ? 'present' : 'MISSING'}`);
} else {
  console.log(`Vercel env check skipped: ${vercel.detail}`);
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
