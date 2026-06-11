#!/usr/bin/env node
/**
 * Verifica variables críticas de emisión / treasury / Morpho en Vercel y local.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  evaluateTokenIssuanceReadiness,
  listManualTasks
} from './tokenIssuanceEnvCatalog.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const web = join(root, 'apps/web');

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

const local = {
  ...parseEnvFile(join(root, '.env')),
  ...parseEnvFile(join(root, '.env.local')),
  ...parseEnvFile(join(root, 'apps/.env.vercel.runtime')),
  ...parseEnvFile(join(web, '.env.local'))
};

const critical = [
  'TOKEN_TREASURY_ADDRESS',
  'TREASURY_OWNER_PRIVATE_KEY',
  'TOKEN_DEPLOY_PRIVATE_KEY',
  'MORPHO_SEED_LIQUIDITY_USDC',
  'RWA_OPERATOR_ADDRESS'
];

console.log('=== Token issuance ops env ===\n');
for (const key of critical) {
  const value = local[key]?.trim() ?? '';
  const ok = Boolean(value);
  console.log(`${ok ? '✓' : '✗'} ${key}${ok ? ` (${key.includes('KEY') ? 'set' : value})` : ' — FALTA'}`);
}

const readiness = evaluateTokenIssuanceReadiness(local);
console.log('\nReadiness:', readiness);

const tasks = listManualTasks(local);
if (tasks.length) {
  console.log('\nTareas manuales:');
  for (const task of tasks) {
    console.log(`- ${task.label}: ${task.hint}`);
  }
}

const vercelList = spawnSync('npx', ['vercel', 'env', 'ls', 'production'], {
  cwd: web,
  encoding: 'utf8'
});

if (vercelList.status === 0) {
  console.log('\nVercel production keys present:');
  for (const key of critical) {
    const present = vercelList.stdout.includes(key);
    console.log(`${present ? '✓' : '✗'} ${key}`);
  }
}

process.exit(
  critical.every((key) => local[key]?.trim()) && readiness.canDeployOnChain ? 0 : 1
);
