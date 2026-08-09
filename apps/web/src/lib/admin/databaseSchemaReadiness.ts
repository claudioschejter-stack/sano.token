import { EXPECTED_MIGRATIONS, prisma } from '@sanova/database';

/**
 * Does the database have the schema this build expects?
 *
 * `prisma migrate deploy` is not wired into any pipeline, so applying a migration
 * is a step somebody has to remember. When it is forgotten the code reaches
 * production ahead of its schema, and the symptom is a 500 for whichever investor
 * touches the missing column — weeks later, far from the cause.
 *
 * The previous check could not catch that. It read the last rows of
 * `_prisma_migrations` and asked whether any had failed halfway; a migration
 * nobody ran has no row at all, so the answer was "the last migrations finished
 * fine" while the enum the card on-ramp needed did not exist. What matters is the
 * difference between what the build expects and what the database has.
 */

export type MigrationReadiness = {
  ok: boolean;
  expected: number;
  applied: number;
  /** In the build, absent from the database: the code is ahead of the schema. */
  missing: string[];
  /** Recorded but never finished; blocks everything after it. */
  unfinished: string[];
  /** In the database, unknown to this build: the deploy is behind, or a rollback. */
  unknown: string[];
  error?: string;
};

type MigrationRow = {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

export async function readMigrationReadiness(): Promise<MigrationReadiness> {
  const expected = [...EXPECTED_MIGRATIONS];

  const rows = await prisma
    .$queryRaw<MigrationRow[]>`
      SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"
    `
    .catch(() => null);

  if (rows === null) {
    return {
      ok: false,
      expected: expected.length,
      applied: 0,
      missing: [],
      unfinished: [],
      unknown: [],
      error: 'no se pudo leer _prisma_migrations'
    };
  }

  const byName = new Map<string, MigrationRow>(rows.map((row) => [row.migration_name, row]));
  const missing: string[] = [];
  const unfinished: string[] = [];

  for (const name of expected) {
    const row = byName.get(name);
    if (!row) {
      missing.push(name);
      continue;
    }
    if (!row.finished_at || row.rolled_back_at) {
      unfinished.push(name);
    }
  }

  const expectedSet = new Set(expected);
  const unknown = rows
    .map((row) => row.migration_name)
    .filter((name) => !expectedSet.has(name));

  return {
    ok: missing.length === 0 && unfinished.length === 0,
    expected: expected.length,
    applied: rows.filter((row) => row.finished_at && !row.rolled_back_at).length,
    missing,
    unfinished,
    unknown
  };
}

export function describeMigrationReadiness(readiness: MigrationReadiness): {
  detail: string;
  fix?: string;
} {
  if (readiness.error) {
    return { detail: readiness.error, fix: 'Revisá la conexión a la base.' };
  }
  if (readiness.missing.length > 0) {
    return {
      detail: `faltan aplicar ${readiness.missing.length}: ${readiness.missing.join(', ')}`,
      fix: 'Corré `npm run db:migrate:deploy` en packages/database contra producción. El código desplegado ya espera este esquema.'
    };
  }
  if (readiness.unfinished.length > 0) {
    return {
      detail: `quedaron a medio aplicar: ${readiness.unfinished.join(', ')}`,
      fix: 'Una migración a medio aplicar bloquea las siguientes: resolvela con `prisma migrate resolve` antes de seguir.'
    };
  }
  if (readiness.unknown.length > 0) {
    return {
      detail: `la base tiene ${readiness.unknown.length} que este build no conoce: ${readiness.unknown.join(', ')}`
    };
  }
  return { detail: `las ${readiness.expected} migraciones del build están aplicadas` };
}
