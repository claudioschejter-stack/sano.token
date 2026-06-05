import { NextResponse } from 'next/server';
import { refreshBorrowRatesCache } from '../../../../lib/lending/fetchLiveBorrowRates';
import { listAdminAssets, listAutomationRepairCandidates } from '../../../../lib/admin/assetsService';
import { notifyAutomationIssue } from '../../../../lib/admin/automationAlerts';
import { executeProjectAutomationRepair } from '../../../../lib/blockchain/projectTokenDeploy';
import { shouldBlockAutomation } from '../../../../lib/admin/automationCircuitBreaker';
import { enqueueAutomationJob, processAutomationJobs } from '../../../../lib/admin/automationJobs';
import { recordRwaSecurityReport } from '../../../../lib/blockchain/rwaSecurityReport';
import { reconcilePayments } from '../../../../lib/payments/paymentReconciliation';
import { recordPortfolioSnapshotsForActiveInvestors } from '../../../../lib/portfolio/portfolioAggregator';
import { isCronRequestAuthorized } from '../../../../lib/cron/authorizeCronRequest';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Vercel Cron — daily maintenance: rates cache + limited RWA automation repair. */
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const borrowRate = await refreshBorrowRatesCache();
    const paymentReconciliation = await reconcilePayments();
    const portfolioSnapshots = await recordPortfolioSnapshotsForActiveInvestors(100);
    const candidates = await listAutomationRepairCandidates(3);
    const activeAssets = await listAdminAssets('ACTIVE');
    const repairs = [];
    const queued = [];
    const securityReports = [];

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

    for (const asset of activeAssets.slice(0, 5)) {
      if (!asset.contractAddress) continue;
      try {
        const report = await recordRwaSecurityReport(asset, { activateBreaker: true });
        securityReports.push({ projectId: asset.id, ok: report.ok });
      } catch (error) {
        securityReports.push({
          projectId: asset.id,
          ok: false,
          error: error instanceof Error ? error.message : 'Security report failed'
        });
      }
    }

    if (process.env.RWA_SYNTHETIC_ENABLED === 'true') {
      const syntheticJob = await enqueueAutomationJob({
        step: 'SYNTHETIC_RWA_FLOW',
        payload: {
          source: 'daily-cron',
          allowedChainIds: process.env.RWA_SYNTHETIC_ALLOWED_CHAIN_IDS ?? '84532,80002,11155111'
        },
        maxAttempts: 1
      });
      if (syntheticJob) {
        queued.push({ jobId: syntheticJob.id, step: 'SYNTHETIC_RWA_FLOW' });
      }
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
      repairs,
      securityReports,
      paymentReconciliation,
      portfolioSnapshots: portfolioSnapshots.length
    });
  } catch (error) {
    console.error('[cron/refresh-borrow-rates]', error);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}
