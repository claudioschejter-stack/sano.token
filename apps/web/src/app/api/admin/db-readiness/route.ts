import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';

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

  const lastMigrations = await prisma
    .$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
      SELECT migration_name, finished_at
      FROM "_prisma_migrations"
      ORDER BY started_at DESC
      LIMIT 5
    `
    .catch(() => null);

  const unfinished = lastMigrations?.filter((row) => row.finished_at === null) ?? [];
  checks.push({
    id: 'migrations_finished',
    ok: unfinished.length === 0,
    detail:
      lastMigrations === null
        ? 'no se pudo leer _prisma_migrations'
        : unfinished.length === 0
          ? 'las últimas migraciones terminaron bien'
          : `quedaron sin terminar: ${unfinished.map((row) => row.migration_name).join(', ')}`,
    fix: unfinished.length === 0 ? undefined : 'Una migración a medio aplicar bloquea las siguientes.'
  });

  return NextResponse.json({
    ok: checks.every((row) => row.ok),
    checks,
    appliedRecently:
      lastMigrations?.map((row) => ({
        name: row.migration_name,
        finishedAt: row.finished_at?.toISOString() ?? null
      })) ?? null
  });
}
