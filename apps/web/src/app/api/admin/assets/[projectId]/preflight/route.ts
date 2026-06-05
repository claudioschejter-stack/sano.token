import { NextResponse } from 'next/server';
import { getAdminAsset } from '../../../../../../lib/admin/assetsService';
import { requireAdminSession } from '../../../../../../lib/admin/requireAdmin';
import { recordAutomationPreflight } from '../../../../../../lib/blockchain/automationPreflight';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { projectId } = await context.params;
  const asset = await getAdminAsset(projectId);
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const preflight = await recordAutomationPreflight(projectId, asset);
  const updatedAsset = await getAdminAsset(projectId);
  return NextResponse.json({ preflight, asset: updatedAsset });
}
