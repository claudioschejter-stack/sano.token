import { NextResponse } from 'next/server';
import { getAdminAsset } from '../../../../../../lib/admin/assetsService';
import { requireAdminSession } from '../../../../../../lib/admin/requireAdmin';
import { repairRwaSecurityConfig } from '../../../../../../lib/blockchain/repairRwaSecurityConfig';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

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

  try {
    const result = await repairRwaSecurityConfig(asset);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[admin/assets/repair-security-config]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Security config repair failed' },
      { status: 500 }
    );
  }
}
