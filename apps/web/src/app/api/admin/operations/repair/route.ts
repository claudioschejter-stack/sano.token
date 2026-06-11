import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';
import { repairBaseMorphoProjects } from '../../../../../lib/admin/platformOperationalReadiness';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { projectIds?: string[]; dryRun?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // empty body repairs all projects that need it
  }

  try {
    const result = await repairBaseMorphoProjects({
      projectIds: body.projectIds,
      dryRun: body.dryRun === true
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[admin/operations/repair]', error);
    return NextResponse.json({ error: 'Operational repair failed' }, { status: 500 });
  }
}
