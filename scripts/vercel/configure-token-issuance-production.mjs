#!/usr/bin/env node
/**
 * Configura emisión RWA en Vercel Production.
 * Default: Base mainnet (8453). Pasar --plume para Plume (98866).
 * Al final imprime tareas manuales pendientes.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTO_CONFIGURE_KEYS,
  SECRET_SYNC_KEYS,
  evaluateTokenIssuanceReadiness,
  listManualTasks,
  mergeTokenIssuanceEnv
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
    if (val.trim()) out[key] = val;
  }
  return out;
}

const profile = process.argv.includes('--plume') ? 'plume' : 'base';
const includePreview = process.argv.includes('--preview');
const dryRun = process.argv.includes('--dry-run');

const local = {
  ...parseEnvFile(join(root, '.env')),
  ...parseEnvFile(join(root, '.env.local')),
  ...parseEnvFile(join(web, '.env.local'))
};

const env = mergeTokenIssuanceEnv(local, profile);
const readiness = evaluateTokenIssuanceReadiness(env);

const keysToSync = [
  ...AUTO_CONFIGURE_KEYS.filter((key) => {
    if (profile === 'base') {
      return !key.startsWith('PLUME_') && !key.startsWith('MORPHO_PLUME') && key !== 'NEXT_PUBLIC_PLUME_RPC_URL';
    }
    return true;
  }),
  ...SECRET_SYNC_KEYS.filter((key) => key !== 'PRIVATE_KEY')
];

const uniqueKeys = [...new Set(keysToSync)];

function setEnv(name, value, environments = includePreview ? ['production', 'preview'] : ['production']) {
  if (!value?.trim()) {
    return 'skipped';
  }

  if (dryRun) {
    console.log(`[dry-run] ${name}@${environments.join(',')}`);
    return 'ok';
  }

  let hadFailure = false;
  for (const target of environments) {
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const result = spawnSync(npx, ['vercel', 'env', 'add', name, target, '--force', '--yes'], {
      cwd: web,
      input: value.trim(),
      encoding: 'utf8',
      shell: process.platform === 'win32'
    });
    if (result.status !== 0) {
      console.error(`failed ${name}@${target}`);
      hadFailure = true;
      continue;
    }
    console.log(`ok ${name}@${target}`);
  }
  return hadFailure ? 'failed' : 'ok';
}

console.log('=== Emisión RWA — Vercel Production ===\n');
console.log(`Perfil: ${readiness.networkLabel}${dryRun ? ' (dry-run)' : ''}\n`);

let ok = 0;
let skipped = 0;
let failed = 0;

for (const name of uniqueKeys) {
  const result = setEnv(name, env[name]);
  if (result === 'ok') ok += 1;
  else if (result === 'failed') failed += 1;
  else skipped += 1;
}

console.log(`\nResumen sync: ok=${ok} skipped=${skipped} failed=${failed}`);

if (failed > 0) {
  process.exit(1);
}

console.log('\n--- Estado emisión ---');
console.log(`  Deploy on-chain: ${readiness.canDeployOnChain ? '✓' : '✗'}`);
console.log(`  USDC colateral Morpho: ${readiness.hasUsdc ? '✓' : '✗'}`);
console.log(`  Centrifuge API: ${readiness.centrifugeReady ? '✓' : '○ pendiente'}`);
console.log(`  Operador = deploy wallet: ${readiness.operatorMatchesDeploy ? '✓' : '○ revisar'}`);

const tasks = listManualTasks(env);
if (tasks.length > 0) {
  console.log('\n--- Pegar / completar manualmente ---');
  for (const task of tasks) {
    console.log(`\n○ ${task.label}`);
    if (task.missing?.length) {
      for (const key of task.missing) {
        console.log(`  → ${key}`);
      }
    }
    if (task.hint) {
      console.log(`  ${task.hint}`);
    }
  }
} else {
  console.log('\n✓ Sin tareas manuales pendientes en .env local.');
}

if (!dryRun) {
  console.log('\nSiguiente:');
  console.log('  cd apps/web && npx vercel --prod --yes');
  console.log('  npm run token-issuance:user-tasks');
}

console.log(`\nHealth: ${(process.env.NEXT_PUBLIC_SITE_URL || 'https://sano-token-web.vercel.app').replace(/\/$/, '')}/api/admin/token-deploy/status`);
