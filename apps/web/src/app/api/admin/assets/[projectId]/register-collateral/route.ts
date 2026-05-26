import { NextResponse } from 'next/server';
import { getAdminAsset } from '../../../../../../lib/admin/assetsService';
import {
  registerProjectCollateral,
  refreshCollateralReadiness
} from '../../../../../../lib/collateral/collateralOrchestrator';
import type { CollateralProtocol } from '../../../../../../lib/admin/launchTypes';
import { requireAdminSession } from '../../../../../../lib/admin/requireAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { projectId } = await context.params;
  const summary = await refreshCollateralReadiness(projectId);

  if (!summary) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  return NextResponse.json(summary);
}

export async function POST(request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { projectId } = await context.params;

  try {
    const body = (await request.json().catch(() => ({}))) as { protocols?: CollateralProtocol[] };
    const asset = await getAdminAsset(projectId);

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const summary = await registerProjectCollateral(projectId, body.protocols);

    return NextResponse.json(summary);
  } catch (error) {
    console.error('[admin/assets/register-collateral]', error);
    return NextResponse.json({ error: 'Collateral registration failed' }, { status: 500 });
  }
}
