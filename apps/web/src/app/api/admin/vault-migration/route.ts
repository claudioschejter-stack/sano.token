import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { advanceVaultMigration } from '../../../../lib/blockchain/vaultMigration';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Admin: where the vault migration stands, without sending anything.
 * `GET /api/admin/vault-migration?projectId=…`
 */
export async function GET(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const projectId = new URL(request.url).searchParams.get('projectId')?.trim();
  if (!projectId) {
    return NextResponse.json({ error: 'PROJECT_ID_REQUIRED' }, { status: 400 });
  }

  try {
    const report = await advanceVaultMigration({ projectId, dryRun: true });
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MIGRATION_PLAN_FAILED';
    console.error('[admin/vault-migration] GET', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Admin: run the next available step of the migration.
 * Body: `{ projectId, force? }`
 *
 * Meant to be called more than once: letting the new vault hold the asset token
 * is timelocked on the old token, so the run stops with the clock started and
 * continues on a later call.
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    projectId?: string;
    force?: boolean;
  };

  const projectId = body.projectId?.trim();
  if (!projectId) {
    return NextResponse.json({ error: 'PROJECT_ID_REQUIRED' }, { status: 400 });
  }

  try {
    const report = await advanceVaultMigration({ projectId, force: body.force });
    return NextResponse.json({ ok: report.done, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MIGRATION_FAILED';
    console.error('[admin/vault-migration] POST', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
