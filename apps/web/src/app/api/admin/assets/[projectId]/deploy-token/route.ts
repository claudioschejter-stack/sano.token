import { NextResponse } from 'next/server';
import { getAdminAsset, updateAdminAsset } from '../../../../../../lib/admin/assetsService';
import { buildSmartContractDocUrl } from '../../../../../../lib/blockchain/deployAssetToken';
import { deployLaunchToken } from '../../../../../../lib/blockchain/deployLaunchToken';
import { registerProjectCollateral } from '../../../../../../lib/collateral/collateralOrchestrator';
import { requireAdminSession } from '../../../../../../lib/admin/requireAdmin';

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { projectId } = await context.params;

  try {
    const asset = await getAdminAsset(projectId);
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (asset.contractAddress) {
      return NextResponse.json({
        asset,
        message: 'Token ya desplegado.',
        explorerUrl: buildSmartContractDocUrl(asset.chainId, asset.contractAddress),
        vaultExplorerUrl: asset.vaultAddress
          ? buildSmartContractDocUrl(asset.chainId, asset.vaultAddress)
          : null
      });
    }

    await updateAdminAsset(projectId, { tokenDeployStatus: 'PENDING' });

    const result = await deployLaunchToken({
      tokenStandard: asset.tokenStandard,
      tokenInstrumentType: asset.tokenInstrumentType,
      tokenName: asset.tokenName ?? asset.title,
      tokenSymbol: asset.tokenSymbol ?? 'RWA',
      totalSupplyUnits: asset.totalTokens
    });

    if (result.status === 'DEPLOYED') {
      const explorerUrl = buildSmartContractDocUrl(result.chainId, result.contractAddress);
      const vaultExplorerUrl = result.vaultAddress
        ? buildSmartContractDocUrl(result.chainId, result.vaultAddress)
        : null;

      const updated = await updateAdminAsset(projectId, {
        tokenDeployStatus: 'DEPLOYED',
        contractAddress: result.contractAddress,
        vaultAddress: result.vaultAddress ?? null,
        chainId: result.chainId,
        contracts: {
          smartContract: vaultExplorerUrl ?? explorerUrl
        }
      });

      let collateralSummary = null;
      if (updated?.collateralTargets.length) {
        collateralSummary = await registerProjectCollateral(projectId);
      }

      return NextResponse.json({
        asset: collateralSummary?.updatedAsset ?? updated,
        txHash: result.txHash,
        explorerUrl,
        vaultExplorerUrl,
        collateral: collateralSummary
      });
    }

    const updated = await updateAdminAsset(projectId, { tokenDeployStatus: 'SKIPPED' });

    return NextResponse.json({
      asset: updated,
      skipped: true,
      reason: result.reason
    });
  } catch (error) {
    console.error('[admin/assets/deploy-token]', error);
    await updateAdminAsset(projectId, { tokenDeployStatus: 'FAILED' });
    return NextResponse.json({ error: 'Token deployment failed' }, { status: 500 });
  }
}
