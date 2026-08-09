import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import {
  describeMigrationReadiness,
  readMigrationReadiness
} from '../../../../lib/admin/databaseSchemaReadiness';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Admin: does the database have what the deployed code expects?
 *
 * Migrations here are applied by hand, so code can reach production ahead of its
 * schema. That failure is invisible from the admin console — an admin skips the
 * second factor, so their own login keeps working while every investor's is
 * broken — and the error only shows up as a 500 for the user who cannot get in.
 * This asks the database directly instead of trusting that the step was done.
 */
export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const checks: Array<{ id: string; ok: boolean; detail: string; fix?: string }> = [];

  const enumValues = await prisma
    .$queryRaw<Array<{ value: string }>>`
      SELECT e.enumlabel AS value
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'VerificationChannel'
    `
    .catch(() => null);

  if (enumValues === null) {
    checks.push({
      id: 'verification_channel_enum',
      ok: false,
      detail: 'no se pudo leer el enum VerificationChannel',
      fix: 'Revisá la conexión a la base.'
    });
  } else {
    const values = enumValues.map((row) => row.value);
    const hasEmailLogin = values.includes('EMAIL_LOGIN');
    checks.push({
      id: 'verification_channel_enum',
      ok: hasEmailLogin,
      detail: hasEmailLogin
        ? `EMAIL_LOGIN presente (${values.join(', ')})`
        : `falta EMAIL_LOGIN, solo hay ${values.join(', ')}`,
      fix: hasEmailLogin
        ? undefined
        : 'Corré `npx prisma migrate deploy` en packages/database contra producción: sin esto ningún inversor puede entrar por desktop.'
    });
  }

  /**
   * Compare what this build expects against what the database has, instead of
   * only asking whether the rows that exist look finished. A migration nobody
   * ran has no row, so the old check called that healthy.
   */
  const migrations = await readMigrationReadiness();
  const described = describeMigrationReadiness(migrations);
  checks.push({
    id: 'migrations_applied',
    ok: migrations.ok,
    detail: described.detail,
    fix: described.fix
  });

  return NextResponse.json({
    ok: checks.every((row) => row.ok),
    checks,
    migrations
  });
}
