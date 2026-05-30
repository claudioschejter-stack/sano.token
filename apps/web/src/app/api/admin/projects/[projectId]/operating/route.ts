import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../../lib/admin/requireAdmin';
import { getProjectOperatingSummary } from '../../../../../../lib/yield/projectOperatingService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { projectId } = await context.params;

  try {
    const summary = await getProjectOperatingSummary(projectId);
    return NextResponse.json(summary);
  } catch (error) {
    console.error('[admin/operating/summary]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load operating summary' },
      { status: 500 }
    );
  }
}
