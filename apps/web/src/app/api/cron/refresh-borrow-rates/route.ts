import { NextResponse } from 'next/server';
import { refreshBorrowRatesCache } from '../../../../lib/lending/fetchLiveBorrowRates';
import { listAutomationRepairCandidates } from '../../../../lib/admin/assetsService';
import { notifyAutomationIssue } from '../../../../lib/admin/automationAlerts';
import { executeProjectAutomationRepair } from '../../../../lib/blockchain/projectTokenDeploy';
import { shouldBlockAutomation } from '../../../../lib/admin/automationCircuitBreaker';

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
        const repair = await executeProjectAutomationRepair(asset.id);
        repairs.push({ projectId: asset.id, status: repair.deploy.status });
        if (repair.deploy.status === 'FAILED' || repair.deploy.status === 'SKIPPED') {
          await notifyAutomationIssue({
            projectId: asset.id,
            title: asset.title,
            message: `La reparación automática terminó con estado ${repair.deploy.status}.`
          });
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

    return NextResponse.json({
      ok: true,
      refreshedAt: borrowRate.best.fetchedAt,
      liveCount: borrowRate.meta?.liveCount ?? 0,
      best: borrowRate.best.name,
      bestApyBps: borrowRate.best.borrowApyBps,
      repairs
    });
  } catch (error) {
    console.error('[cron/refresh-borrow-rates]', error);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}
