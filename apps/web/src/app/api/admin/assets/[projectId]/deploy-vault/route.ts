import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../../lib/admin/requireAdmin';
import { executeProjectVaultDeploy } from '../../../../../../lib/blockchain/projectTokenDeploy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

/** Deploy ERC-4626 vault for an asset that already has SanovaAssetToken on-chain. */
export async function POST(_request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { projectId } = await context.params;

  try {
    const result = await executeProjectVaultDeploy(projectId);

    if (result.status === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (result.status === 'ALREADY_HAS_VAULT') {
      return NextResponse.json({
        asset: result.asset,
        message: 'Vault ya desplegado.',
        vaultExplorerUrl: result.vaultExplorerUrl
      });
    }

    if (result.status === 'DEPLOYED') {
      return NextResponse.json({
        asset: result.asset,
        vaultAddress: result.vaultAddress,
        vaultExplorerUrl: result.vaultExplorerUrl,
        txHash: result.txHash,
        collateral: result.collateral
      });
    }

    if (result.status === 'FAILED') {
      return NextResponse.json({ error: result.reason }, { status: 500 });
    }

    return NextResponse.json({ asset: result.asset, skipped: true, reason: result.reason });
  } catch (error) {
    console.error('[admin/assets/deploy-vault]', error);
    return NextResponse.json({ error: 'Vault deployment failed' }, { status: 500 });
  }
}
