import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';
import { cancelAutomationJob, retryAutomationJob } from '../../../../../lib/admin/automationJobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { jobId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  const job =
    body.action === 'retry'
      ? await retryAutomationJob(jobId)
      : body.action === 'cancel'
        ? await cancelAutomationJob(jobId)
        : null;

  if (!job) {
    return NextResponse.json({ error: 'Invalid job action or job table unavailable' }, { status: 400 });
  }

  return NextResponse.json({ job });
}
