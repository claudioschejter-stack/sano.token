import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';

export const dynamic = 'force-dynamic';

/**
 * One-off, secret-guarded endpoint to apply the Investor.loansEnabled column
 * in production where sensitive DATABASE_URL env vars cannot be pulled locally.
 * Remove this route after the migration has been verified as applied.
 */
export async function GET(request: Request) {
  const expected = process.env.ADMIN_MIGRATION_SECRET;
  const provided = request.headers.get('x-migration-secret');

  if (!expected || provided !== expected) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Investor" ADD COLUMN IF NOT EXISTS "loansEnabled" BOOLEAN NOT NULL DEFAULT false;'
    );

    const columns = await prisma.$queryRawUnsafe<Array<{ column_name: string; data_type: string; column_default: string | null }>>(
      `SELECT column_name, data_type, column_default
       FROM information_schema.columns
       WHERE table_name = 'Investor' AND column_name = 'loansEnabled'`
    );

    return NextResponse.json({ ok: true, columns });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MIGRATION_FAILED';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
