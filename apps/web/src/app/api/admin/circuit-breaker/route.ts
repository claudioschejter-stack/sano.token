import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { listAdminAssets } from '../../../../lib/admin/assetsService';
import {
  globalAutomationDisabled,
  resetCircuitBreaker,
  shouldBlockAutomation
} from '../../../../lib/admin/automationCircuitBreaker';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** Admin: which assets have automation blocked, and why. */
export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const assets = await listAdminAssets();
  return NextResponse.json({
    ok: true,
    globalAutomationDisabled: globalAutomationDisabled(),
    blocked: assets
      .map((asset) => ({
        projectId: asset.id,
        title: asset.title,
        circuitBreaker: asset.automationCircuitBreaker,
        failureCount: asset.automationFailureCount,
        reason: shouldBlockAutomation(asset)
      }))
      .filter((row) => row.reason !== null)
  });
}

/**
 * Admin: release the automation circuit breaker for an asset.
 *
 * Body: `{ projectId, reason }`
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    projectId?: string;
    reason?: string;
  };

  if (!body.projectId?.trim()) {
    return NextResponse.json({ error: 'PROJECT_ID_REQUIRED' }, { status: 400 });
  }

  try {
    const asset = await resetCircuitBreaker(
      body.projectId.trim(),
      body.reason?.trim() || 'liberado desde el panel de admin'
    );

    if (!asset) {
      return NextResponse.json({ error: 'PROJECT_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      projectId: asset.id,
      title: asset.title,
      circuitBreaker: asset.automationCircuitBreaker,
      failureCount: asset.automationFailureCount,
      readyToBorrow: asset.readyToBorrow,
      stillBlockedBy: shouldBlockAutomation(asset)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'CIRCUIT_BREAKER_RESET_FAILED';
    console.error('[admin/circuit-breaker]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
