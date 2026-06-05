import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { listAdminAssets } from '../../../../lib/admin/assetsService';
import { buildMorphoLiquiditySnapshot } from '../../../../lib/lending/morphoLiquiditySnapshot';
import { aggregatePortfolioForUser } from '../../../../lib/portfolio/portfolioAggregator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const role = session.user.role;
  const allAssets = await listAdminAssets('ALL');

  let assets = allAssets;

  if (role !== 'ADMIN') {
    const portfolio = await aggregatePortfolioForUser(session.user.id);
    const holdingIds = new Set(
      portfolio.positions
        .map((position) => position.metadata?.projectId)
        .filter((projectId): projectId is string => typeof projectId === 'string')
    );
    assets = allAssets.filter((asset) => holdingIds.has(asset.id));
  }

  const snapshot = await buildMorphoLiquiditySnapshot(assets);
  return NextResponse.json(snapshot);
}
