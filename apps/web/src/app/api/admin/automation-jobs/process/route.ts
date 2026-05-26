import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';
import { processAutomationJobs } from '../../../../../lib/admin/automationJobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { limit?: number };
  const limit = Number.isInteger(body.limit) ? Math.min(20, Math.max(1, Number(body.limit))) : 5;
  const result = await processAutomationJobs(limit);
  return NextResponse.json(result);
}
