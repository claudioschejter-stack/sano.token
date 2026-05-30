import { NextResponse } from 'next/server';
import { processAutomationJobs } from '../../../../lib/admin/automationJobs';
import { autoEnqueueEligibleYieldBatches } from '../../../../lib/yield/yieldJobProcessor';

export const dynamic = 'force-dynamic';

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }

  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

/** Cron — auto-batch tenant operating balances, convert fiat, distribute USDC to vaults. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const enqueued = await autoEnqueueEligibleYieldBatches();
    const jobRun = await processAutomationJobs(10);

    return NextResponse.json({
      ok: true,
      enqueued,
      jobRun,
      processedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[cron/process-yield-batches]', error);
    return NextResponse.json({ error: 'Yield cron failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
