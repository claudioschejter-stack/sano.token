import { NextResponse } from 'next/server';
import { processAutomationJobs } from '../../../../lib/admin/automationJobs';
import { isCronRequestAuthorized } from '../../../../lib/cron/authorizeCronRequest';

export const maxDuration = 300;

/** Cron — drain AutomationJob queue (deploy pipeline, yield, explorer). */
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const jobRun = await processAutomationJobs(10);
    return NextResponse.json({
      ok: true,
      jobRun,
      processedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[cron/process-automation-jobs]', error);
    return NextResponse.json({ error: 'Automation cron failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
