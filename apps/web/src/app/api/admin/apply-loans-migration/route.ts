import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';

const MIGRATION_NAME = '20260714010000_add_investor_loans_enabled';
// sha256 of packages/database/prisma/migrations/20260714010000_add_investor_loans_enabled/migration.sql
const MIGRATION_CHECKSUM = '861162ba8bd7ef4eff849175beea543be7e741991dc820afd75316e286cb6687';

export const dynamic = 'force-dynamic';

/**
 * One-off, secret-guarded endpoint to sync the `Investor.loansEnabled`
 * column in production. Runs inside Vercel's runtime, where the real
 * DATABASE_URL is injected (unlike `vercel env pull`, which masks
 * sensitive vars for local use). Delete this file once confirmed applied.
 */
export async function GET(request: Request) {
  const expected = process.env.ADMIN_MIGRATION_SECRET;
  const provided = request.headers.get('x-migration-secret');

  if (!expected || provided !== expected) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const before = await prisma.$queryRawUnsafe<
      Array<{ column_name: string; data_type: string; column_default: string | null }>
    >(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'Investor' AND column_name = 'loansEnabled'
    `);

    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Investor" ADD COLUMN IF NOT EXISTS "loansEnabled" BOOLEAN NOT NULL DEFAULT false;'
    );

    const after = await prisma.$queryRawUnsafe<
      Array<{ column_name: string; data_type: string; column_default: string | null }>
    >(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'Investor' AND column_name = 'loansEnabled'
    `);

    let migrationRows: Array<{ migration_name: string; finished_at: Date | null }> = [];
    let migrationRecordInserted = false;
    try {
      migrationRows = await prisma.$queryRawUnsafe(`
        SELECT migration_name, finished_at
        FROM "_prisma_migrations"
        WHERE migration_name = '${MIGRATION_NAME}'
      `);

      if (migrationRows.length === 0) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "_prisma_migrations"
             (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
           VALUES ($1, $2, $3, now(), now(), 1)`,
          randomUUID(),
          MIGRATION_CHECKSUM,
          MIGRATION_NAME
        );
        migrationRecordInserted = true;
        migrationRows = await prisma.$queryRawUnsafe(`
          SELECT migration_name, finished_at
          FROM "_prisma_migrations"
          WHERE migration_name = '${MIGRATION_NAME}'
        `);
      }
    } catch (migrationTableError) {
      // _prisma_migrations bookkeeping is best-effort; the column change above is what matters.
      return NextResponse.json({
        ok: true,
        before,
        after,
        migrationRows,
        migrationRecordInserted,
        migrationTableWarning:
          migrationTableError instanceof Error ? migrationTableError.message : 'MIGRATION_TABLE_LOOKUP_FAILED'
      });
    }

    return NextResponse.json({ ok: true, before, after, migrationRows, migrationRecordInserted });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MIGRATION_FAILED';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
