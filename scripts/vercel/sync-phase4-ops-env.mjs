#!/usr/bin/env node
/**
 * Sync Phase 4 ops env vars to Vercel (production + preview).
 * Reads from .env / apps/web/.env.local — never logs secret values.
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

// Preview requires a git branch in Vercel CLI 54+ (non-interactive fails). Use development for vercel dev.
// Note: BLOCKCHAIN_LISTENER_* on Vercel web is informational — listener runs on Nest worker only.
function addEnv(name, value, environments = ['production', 'development']) {
  if (value === undefined || value === null || !String(value).trim()) {
    console.log(`skip ${name} (empty — set in .env and re-run)`);
    return false;
  }
  for (const target of environments) {
    const result = spawnSync(
      'npx',
      ['vercel', 'env', 'add', name, target, '--value', String(value).trim(), '--force', '--yes'],
      {
        cwd: root,
        encoding: 'utf8',
        shell: true
      }
    );
    if (result.status !== 0) {
      console.error(`failed ${name}@${target}:`, result.stderr?.slice(0, 300) || result.stdout?.slice(0, 300));
      return false;
    }
    console.log(`ok ${name}@${target}`);
  }
  return true;
}

const blockchainRpc =
  env.BLOCKCHAIN_RPC_URL?.trim() ||
  env.LENDING_BASE_RPC_URL?.trim() ||
  env.BASE_RPC_URL?.trim() ||
  '';

const sentryDsn = env.SENTRY_DSN?.trim() || env.NEXT_PUBLIC_SENTRY_DSN?.trim() || '';

console.log('=== Sync Phase 4 ops env → Vercel ===\n');

addEnv('BLOCKCHAIN_LISTENER_ENABLED', env.BLOCKCHAIN_LISTENER_ENABLED?.trim() || 'true');
addEnv('BLOCKCHAIN_WRITES_ENABLED', env.BLOCKCHAIN_WRITES_ENABLED?.trim() || 'true');
addEnv('BLOCKCHAIN_RPC_URL', blockchainRpc);
addEnv('AUTOMATION_SLACK_WEBHOOK_URL', env.AUTOMATION_SLACK_WEBHOOK_URL?.trim());
addEnv('SENTRY_DSN', sentryDsn);
if (sentryDsn) {
  addEnv('NEXT_PUBLIC_SENTRY_DSN', sentryDsn);
}

console.log('\nDone. Run: npm run vercel:check-phase4-ops');
