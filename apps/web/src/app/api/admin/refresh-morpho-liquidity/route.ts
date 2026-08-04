import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { listAdminAssets } from '../../../../lib/admin/assetsService';
import { probeMorphoLiquidityStatus } from '../../../../lib/lending/morphoLiquidityCheck';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Admin: re-read Morpho liquidity from the chain and store what it finds.
 *
 * The stored status only changes when something probes, so a market that was
 * probed during an RPC outage stays marked as failed — and the platform keeps
 * reporting the asset as not ready to borrow — long after it has liquidity.
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { projectIds?: string[] };

  try {
    const assets = await listAdminAssets();
    const targets = body.projectIds?.length
      ? assets.filter((asset) => body.projectIds!.includes(asset.id))
      : assets;

    const results = [];
    for (const asset of targets) {
      const before = asset.morphoLiquidityStatus ?? null;
      try {
        const probe = await probeMorphoLiquidityStatus(asset);
        results.push({
          projectId: asset.id,
          title: asset.title,
          before,
          after: probe.status,
          availableAssets: probe.availableAssets,
          error: 'error' in probe ? probe.error : undefined
        });
      } catch (error) {
        results.push({
          projectId: asset.id,
          title: asset.title,
          before,
          after: 'ERROR',
          error: error instanceof Error ? error.message.slice(0, 200) : 'PROBE_FAILED'
        });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'REFRESH_LIQUIDITY_FAILED';
    console.error('[admin/refresh-morpho-liquidity]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
