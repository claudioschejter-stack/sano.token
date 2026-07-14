import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';

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
    try {
      migrationRows = await prisma.$queryRawUnsafe(`
        SELECT migration_name, finished_at
        FROM "_prisma_migrations"
        WHERE migration_name = '20260714010000_add_investor_loans_enabled'
      `);
    } catch {
      // _prisma_migrations lookup is best-effort diagnostics only.
    }

    return NextResponse.json({ ok: true, before, after, migrationRows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MIGRATION_FAILED';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
