import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { listAutomationJobs, type AutomationJobStatus } from '../../../../lib/admin/automationJobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = (url.searchParams.get('status') ?? 'ALL') as AutomationJobStatus | 'ALL';
  const projectId = url.searchParams.get('projectId') ?? undefined;
  const limit = Number.parseInt(url.searchParams.get('limit') ?? '25', 10);
  const result = await listAutomationJobs({ status, projectId, limit });
  return NextResponse.json(result);
}
