import { NextResponse } from 'next/server';
import { refreshBorrowRatesCache } from '../../../../lib/lending/fetchLiveBorrowRates';
import { listAutomationRepairCandidates } from '../../../../lib/admin/assetsService';
import { notifyAutomationIssue } from '../../../../lib/admin/automationAlerts';
import { executeProjectAutomationRepair } from '../../../../lib/blockchain/projectTokenDeploy';
import { shouldBlockAutomation } from '../../../../lib/admin/automationCircuitBreaker';
import { enqueueAutomationJob, processAutomationJobs } from '../../../../lib/admin/automationJobs';

export const dynamic = 'force-dynamic';

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }

  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

/** Vercel Cron — daily maintenance: rates cache + limited RWA automation repair. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const borrowRate = await refreshBorrowRatesCache();
    const candidates = await listAutomationRepairCandidates(3);
    const repairs = [];
    const queued = [];

    for (const asset of candidates) {
      const blockReason = shouldBlockAutomation(asset);
      if (blockReason) {
        repairs.push({ projectId: asset.id, status: 'SKIPPED', message: blockReason });
        await notifyAutomationIssue({
          projectId: asset.id,
          title: asset.title,
          message: blockReason
        });
        continue;
      }

      try {
        const job = await enqueueAutomationJob({
          projectId: asset.id,
          step: 'TOKEN_DEPLOY',
          payload: { source: 'daily-cron-repair' }
        });
        if (job) {
          queued.push({ projectId: asset.id, jobId: job.id, step: 'TOKEN_DEPLOY' });
        } else {
          const repair = await executeProjectAutomationRepair(asset.id);
          repairs.push({ projectId: asset.id, status: repair.deploy.status });
          if (repair.deploy.status === 'FAILED' || repair.deploy.status === 'SKIPPED') {
            await notifyAutomationIssue({
              projectId: asset.id,
              title: asset.title,
              message: `La reparación automática terminó con estado ${repair.deploy.status}.`
            });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown repair error';
        repairs.push({ projectId: asset.id, status: 'FAILED', message });
        await notifyAutomationIssue({
          projectId: asset.id,
          title: asset.title,
          message
        });
      }
    }

    const syntheticJob = await enqueueAutomationJob({
      step: 'SYNTHETIC_RWA_FLOW',
      payload: { source: 'daily-cron' },
      maxAttempts: 1
    });
    if (syntheticJob) {
      queued.push({ jobId: syntheticJob.id, step: 'SYNTHETIC_RWA_FLOW' });
    }
    const jobRun = await processAutomationJobs(5);

    return NextResponse.json({
      ok: true,
      refreshedAt: borrowRate.best.fetchedAt,
      liveCount: borrowRate.meta?.liveCount ?? 0,
      best: borrowRate.best.name,
      bestApyBps: borrowRate.best.borrowApyBps,
      queued,
      jobRun,
      repairs
    });
  } catch (error) {
    console.error('[cron/refresh-borrow-rates]', error);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}
