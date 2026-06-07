#!/usr/bin/env node
/**
 * Lista tareas manuales para emisión RWA (lo que no puede automatizar el script).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateTokenIssuanceReadiness,
  listManualTasks,
  mergeTokenIssuanceEnv
} from './tokenIssuanceEnvCatalog.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://sano-token-web.vercel.app').replace(/\/$/, '');

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
const local = {
  ...parseEnvFile(join(root, '.env')),
  ...parseEnvFile(join(root, '.env.local')),
  ...parseEnvFile(join(root, 'apps/web/.env.local'))
};

const env = mergeTokenIssuanceEnv(local, profile);
const readiness = evaluateTokenIssuanceReadiness(env);
const tasks = listManualTasks(env);

console.log('=== Tareas manuales — Emisión de tokens RWA ===\n');
console.log(`Perfil: ${readiness.networkLabel}`);
console.log(`Listo para deploy on-chain: ${readiness.productionReady ? 'SÍ' : 'NO'}\n`);

if (tasks.length === 0) {
  console.log('✓ No hay tareas pendientes en .env local.');
} else {
  for (const task of tasks) {
    console.log(`○ ${task.label}`);
    if (task.missing?.length) {
      for (const key of task.missing) {
        console.log(`    → ${key}`);
      }
    }
    if (task.hint) {
      console.log(`    ${task.hint}`);
    }
    console.log('');
  }
}

console.log('Después de completar .env local:');
console.log('  npm run vercel:configure-token-issuance');
if (profile === 'base') {
  console.log('  # Para Plume: npm run vercel:configure-token-issuance -- --plume');
}

console.log('\nVerificación en producción:');
console.log(`  ${siteUrl}/api/admin/token-deploy/status`);
console.log('\nColateral por proyecto:');
console.log(`  POST ${siteUrl}/api/admin/assets/{projectId}/register-collateral`);
console.log('\nDocs: docs/runbooks/plume-erc7540-launch.md');
