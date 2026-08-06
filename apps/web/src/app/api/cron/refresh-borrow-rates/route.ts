import { NextResponse } from 'next/server';
import { refreshBorrowRatesCache } from '../../../../lib/lending/fetchLiveBorrowRates';
import { listAdminAssets, listInfrastructureRepairCandidates, resolveInfrastructureRepairStep } from '../../../../lib/admin/assetsService';
import { notifyAutomationIssue } from '../../../../lib/admin/automationAlerts';
import { executeProjectInfrastructureRepair } from '../../../../lib/blockchain/projectTokenDeploy';
import { shouldBlockAutomation } from '../../../../lib/admin/automationCircuitBreaker';
import { enqueueAutomationJob } from '../../../../lib/admin/automationJobs';
import { recordRwaSecurityReport } from '../../../../lib/blockchain/rwaSecurityReport';
import { reconcilePayments } from '../../../../lib/payments/paymentReconciliation';
import { recordPortfolioSnapshotsForActiveInvestors } from '../../../../lib/portfolio/portfolioAggregator';
import { isCronRequestAllowed } from '../../../../lib/cron/authorizeCronRequest';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Vercel Cron — daily maintenance: rates cache + infrastructure repair (no token emission). */
export async function GET(request: Request) {
  if (!(await isCronRequestAllowed(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const borrowRate = await refreshBorrowRatesCache();
    const paymentReconciliation = await reconcilePayments();
    const portfolioSnapshots = await recordPortfolioSnapshotsForActiveInvestors(100);
    const candidates = await listInfrastructureRepairCandidates(3);
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

    /**
     * Reconciling against the markets the chain actually has replaces probing
     * each asset with a recomputed market id: a market created with a different
     * LLTV or oracle used to read as empty, so an asset stayed marked illiquid
     * while its liquidity sat untouched, and only a manual pass could fix it.
     */
    let morphoReconcile: unknown = null;
    try {
      const { JsonRpcProvider } = await import('ethers');
      const { reconcileMorphoMarkets } = await import(
        '../../../../lib/lending/reconcileMorphoMarkets'
      );
      const rpc = new JsonRpcProvider(
        process.env.LENDING_BASE_RPC_URL?.trim() ||
          process.env.BASE_RPC_URL?.trim() ||
          'https://mainnet.base.org'
      );
      try {
        const reconciled = await reconcileMorphoMarkets({ provider: rpc });
        morphoReconcile = reconciled.summary;
        for (const row of reconciled.rows) {
          liquidityProbes.push({ projectId: row.projectId, status: row.liquidityAfter ?? 'UNKNOWN' });
        }
      } finally {
        rpc.destroy();
      }
    } catch (error) {
      morphoReconcile = {
        error: error instanceof Error ? error.message.slice(0, 200) : 'MORPHO_RECONCILE_FAILED'
      };
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
          allowedChainIds: process.env.RWA_SYNTHETIC_ALLOWED_CHAIN_IDS ?? '8453'
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
      liquidityProbes,
      morphoReconcile
    });
  } catch (error) {
    console.error('[cron/refresh-borrow-rates]', error);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}
