#!/usr/bin/env node
/**
 * Write down which migrations the code being deployed expects.
 *
 * `prisma migrate deploy` is not wired into any pipeline, so applying a migration
 * is a step somebody has to remember — and the enum rename that the card on-ramp
 * needed sat unapplied while the code that required it was already live.
 *
 * The readiness check could not catch it: it only looked at rows in
 * `_prisma_migrations`, and a migration nobody ran has no row, so "the last
 * migrations finished fine" was true and useless. The migration directory is not
 * bundled into the deployed app, so the list has to be captured at build time.
 */
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, '../prisma/migrations');
const outFile = resolve(here, '../src/migrationManifest.ts');

const names = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const body = `// Generado por scripts/generate-migration-manifest.mjs — no editar a mano.
// Las migraciones que este build espera encontrar aplicadas en la base.
export const EXPECTED_MIGRATIONS: readonly string[] = [
${names.map((name) => `  '${name}'`).join(',\n')}
] as const;
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, body, 'utf8');
console.log(`[migration-manifest] ${names.length} migraciones registradas`);
