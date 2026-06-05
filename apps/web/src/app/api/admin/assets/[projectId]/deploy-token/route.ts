import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../../lib/admin/requireAdmin';
import { executeProjectTokenDeploy } from '../../../../../../lib/blockchain/projectTokenDeploy';

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

  try {
    const result = await executeProjectTokenDeploy(projectId);

    if (result.status === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (result.status === 'ALREADY_DEPLOYED') {
      return NextResponse.json({
        asset: result.asset,
        message: 'Token ya desplegado.',
        explorerUrl: result.explorerUrl,
        vaultExplorerUrl: result.vaultExplorerUrl
      });
    }

    if (result.status === 'DEPLOYED') {
      return NextResponse.json({
        asset: result.asset,
        txHash: result.txHash,
        explorerUrl: result.explorerUrl,
        vaultExplorerUrl: result.vaultExplorerUrl,
        collateral: result.collateral
      });
    }

    if (result.status === 'FAILED') {
      return NextResponse.json({ error: result.reason }, { status: 500 });
    }

    return NextResponse.json({
      asset: result.asset,
      skipped: true,
      reason: result.reason
    });
  } catch (error) {
    console.error('[admin/assets/deploy-token]', error);
    return NextResponse.json({ error: 'Token deployment failed' }, { status: 500 });
  }
}
