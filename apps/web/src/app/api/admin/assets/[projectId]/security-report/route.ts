import { NextResponse } from 'next/server';
import { getAdminAsset } from '../../../../../../lib/admin/assetsService';
import { requireAdminSession } from '../../../../../../lib/admin/requireAdmin';
import { recordRwaSecurityReport } from '../../../../../../lib/blockchain/rwaSecurityReport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { projectId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { activateBreaker?: boolean };
  const asset = await getAdminAsset(projectId);
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const report = await recordRwaSecurityReport(asset, { activateBreaker: Boolean(body.activateBreaker) });
  return NextResponse.json({ report });
}
