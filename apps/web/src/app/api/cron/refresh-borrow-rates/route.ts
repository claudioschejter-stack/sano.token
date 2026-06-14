import { NextResponse } from 'next/server';
import { refreshBorrowRatesCache } from '../../../../lib/lending/fetchLiveBorrowRates';
import { listAdminAssets, listInfrastructureRepairCandidates, listMorphoLiquidityProbeCandidates, resolveInfrastructureRepairStep } from '../../../../lib/admin/assetsService';
import { notifyAutomationIssue } from '../../../../lib/admin/automationAlerts';
import { executeProjectInfrastructureRepair } from '../../../../lib/blockchain/projectTokenDeploy';
import { shouldBlockAutomation } from '../../../../lib/admin/automationCircuitBreaker';
import { enqueueAutomationJob } from '../../../../lib/admin/automationJobs';
import { recordRwaSecurityReport } from '../../../../lib/blockchain/rwaSecurityReport';
import { reconcilePayments } from '../../../../lib/payments/paymentReconciliation';
import { recordPortfolioSnapshotsForActiveInvestors } from '../../../../lib/portfolio/portfolioAggregator';
import { isCronRequestAuthorized } from '../../../../lib/cron/authorizeCronRequest';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Vercel Cron — daily maintenance: rates cache + infrastructure repair (no token emission). */
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const borrowRate = await refreshBorrowRatesCache();
    const paymentReconciliation = await reconcilePayments();
    const portfolioSnapshots = await recordPortfolioSnapshotsForActiveInvestors(100);
    const candidates = await listInfrastructureRepairCandidates(3);
    const liquidityCandidates = await listMorphoLiquidityProbeCandidates(12);
    const activeAssets = await listAdminAssets('ACTIVE');
    const repairs = [];
    const queued = [];
    const securityReports = [];
    const liquidityProbes = [];

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
        const step = resolveInfrastructureRepairStep(asset);
        if (!step) {
          repairs.push({ projectId: asset.id, status: 'SKIPPED', message: 'NO_REPAIR_STEP' });
          continue;
        }

        const job = await enqueueAutomationJob({
          projectId: asset.id,
          step,
          payload: { source: 'daily-cron-infrastructure-repair' }
        });
        if (job) {
          queued.push({ projectId: asset.id, jobId: job.id, step });
        } else {
          const repair = await executeProjectInfrastructureRepair(asset.id);
          repairs.push({ projectId: asset.id, status: 'INFRASTRUCTURE_REPAIRED', asset: repair.asset?.id });
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

    const { probeMorphoLiquidityStatus } = await import('../../../../lib/lending/morphoLiquidityCheck');
    for (const asset of liquidityCandidates) {
      try {
        const probe = await probeMorphoLiquidityStatus(asset);
        liquidityProbes.push({ projectId: asset.id, status: probe.status });
      } catch (error) {
        liquidityProbes.push({
          projectId: asset.id,
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'probe failed'
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
          adminAuthorized: false,
          allowedChainIds: process.env.RWA_SYNTHETIC_ALLOWED_CHAIN_IDS ?? '84532,80002,11155111'
        },
        maxAttempts: 1
      });
      if (syntheticJob) {
        queued.push({ jobId: syntheticJob.id, step: 'SYNTHETIC_RWA_FLOW' });
      }
    }
    return NextResponse.json({
      ok: true,
      refreshedAt: borrowRate.best.fetchedAt,
      liveCount: borrowRate.meta?.liveCount ?? 0,
      best: borrowRate.best.name,
      bestApyBps: borrowRate.best.borrowApyBps,
      queued,
      repairs,
      securityReports,
      paymentReconciliation,
      portfolioSnapshots: portfolioSnapshots.length,
      liquidityProbes
    });
  } catch (error) {
    console.error('[cron/refresh-borrow-rates]', error);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}
