#!/usr/bin/env node
/**
 * Audit + optional repair for Base / ERC-4626 / Morpho operational readiness.
 *
 * Usage:
 *   npx tsx scripts/ops/base-morpho-readiness.ts
 *   npx tsx scripts/ops/base-morpho-readiness.ts --repair
 *   npx tsx scripts/ops/base-morpho-readiness.ts --repair --project-id proj-...
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
config({ path: resolve(root, 'packages/database/.env') });
config({ path: resolve(root, '.env') });
config({ path: resolve(root, '.env.local') });
config({ path: resolve(root, '.env.production.local') });
config({ path: resolve(root, 'apps/.env.vercel.runtime') });
config({ path: resolve(root, 'apps/web/.env.vercel.prod.current') });
config({ path: resolve(root, '.env.vercel.production') });
config({ path: resolve(root, 'apps/web/.env.local') });

if (process.env.DIRECT_URL?.trim()) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import {
  auditPlatformOperationalReadiness,
  repairBaseMorphoProjects,
  type OpsCheck
} from '../../apps/web/src/lib/admin/platformOperationalReadiness';

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function printChecks(title: string, checks: OpsCheck[]) {
  console.log(`\n=== ${title} ===`);
  for (const check of checks) {
    const icon = check.status === 'OK' ? '✓' : check.status === 'WARN' ? '!' : '✗';
    console.log(`${icon} [${check.status}] ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
  }
}

async function main() {
  const repair = process.argv.includes('--repair');
  const dryRun = process.argv.includes('--dry-run');
  const projectId = readArg('--project-id');

  const report = await auditPlatformOperationalReadiness();
  printChecks('Plataforma', report.platformChecks);
  console.log('\n=== Proyectos BASE_MORPHO_4626 ===');
  console.log(JSON.stringify(report.summary, null, 2));

  for (const project of report.projects) {
    console.log(`\n--- ${project.title} (${project.projectId}) ---`);
    printChecks('Checks', project.checks);
    if (project.issues.length) {
      console.log('Issues:', project.issues.join('; '));
    }
  }

  if (!repair) {
    console.log('\nSiguiente paso: npx tsx scripts/ops/base-morpho-readiness.ts --repair');
    process.exit(report.summary.platformReady ? 0 : 1);
  }

  const result = await repairBaseMorphoProjects({
    projectIds: projectId ? [projectId] : undefined,
    dryRun
  });

  console.log('\n=== Repair ===');
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.after?.platformReady ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
