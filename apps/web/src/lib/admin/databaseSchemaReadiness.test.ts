import { beforeEach, describe, expect, it, vi } from 'vitest';

let rows: Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }> = [];
let queryThrows = false;

vi.mock('@sanova/database', () => ({
  EXPECTED_MIGRATIONS: ['0001_baseline', '0002_wallets', '0003_rename_enum'],
  prisma: {
    $queryRaw: async () => {
      if (queryThrows) throw new Error('connection lost');
      return rows;
    }
  }
}));

const { describeMigrationReadiness, readMigrationReadiness } = await import(
  './databaseSchemaReadiness'
);

function applied(name: string) {
  return { migration_name: name, finished_at: new Date(), rolled_back_at: null };
}

beforeEach(() => {
  queryThrows = false;
  rows = ['0001_baseline', '0002_wallets', '0003_rename_enum'].map(applied);
});

describe('readMigrationReadiness', () => {
  it('passes when the database has every migration the build expects', async () => {
    const readiness = await readMigrationReadiness();
    expect(readiness.ok).toBe(true);
    expect(readiness.applied).toBe(3);
    expect(readiness.missing).toEqual([]);
  });

  it('catches a migration that was never run, which has no row at all', async () => {
    // This is the case the old check missed: it read existing rows and asked
    // whether they had failed, and an unrun migration has nothing to read.
    rows = [applied('0001_baseline'), applied('0002_wallets')];

    const readiness = await readMigrationReadiness();

    expect(readiness.ok).toBe(false);
    expect(readiness.missing).toEqual(['0003_rename_enum']);
    expect(describeMigrationReadiness(readiness).fix).toContain('db:migrate:deploy');
  });

  it('still catches one recorded but never finished', async () => {
    rows = [
      applied('0001_baseline'),
      applied('0002_wallets'),
      { migration_name: '0003_rename_enum', finished_at: null, rolled_back_at: null }
    ];

    const readiness = await readMigrationReadiness();

    expect(readiness.ok).toBe(false);
    expect(readiness.unfinished).toEqual(['0003_rename_enum']);
    expect(describeMigrationReadiness(readiness).fix).toContain('migrate resolve');
  });

  it('treats a rolled back migration as not applied', async () => {
    rows = [
      applied('0001_baseline'),
      applied('0002_wallets'),
      { migration_name: '0003_rename_enum', finished_at: new Date(), rolled_back_at: new Date() }
    ];

    expect((await readMigrationReadiness()).unfinished).toEqual(['0003_rename_enum']);
  });

  it('reports a database ahead of the build without calling it a failure', async () => {
    // A rollback of the app leaves migrations the running code does not know
    // about. That is worth saying, but it is not the code outrunning the schema.
    rows = [...rows, applied('0004_from_a_newer_deploy')];

    const readiness = await readMigrationReadiness();

    expect(readiness.ok).toBe(true);
    expect(readiness.unknown).toEqual(['0004_from_a_newer_deploy']);
    expect(describeMigrationReadiness(readiness).detail).toContain('no conoce');
  });

  it('does not claim the schema is fine when the table cannot be read', async () => {
    queryThrows = true;

    const readiness = await readMigrationReadiness();

    expect(readiness.ok).toBe(false);
    expect(readiness.error).toContain('_prisma_migrations');
  });
});
