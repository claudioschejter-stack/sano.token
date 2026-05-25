import type { AdminAssetRecord } from '../admin/assetsService';
import { getAdminAsset, updateAdminAsset } from '../admin/assetsService';
import { buildSmartContractDocUrl } from './explorerUrls';
import { deployLaunchToken } from './deployLaunchToken';

export type ProjectTokenDeployResult =
  | {
      status: 'DEPLOYED';
      asset: AdminAssetRecord;
      txHash: string;
      explorerUrl: string;
      vaultExplorerUrl: string | null;
      collateral: Awaited<ReturnType<typeof import('../collateral/collateralOrchestrator').registerProjectCollateral>> | null;
    }
  | {
      status: 'ALREADY_DEPLOYED';
      asset: AdminAssetRecord;
      explorerUrl: string;
      vaultExplorerUrl: string | null;
    }
  | { status: 'SKIPPED'; asset: AdminAssetRecord | null; reason: string }
  | { status: 'NOT_FOUND' }
  | { status: 'FAILED'; reason: string };

export async function executeProjectTokenDeploy(projectId: string): Promise<ProjectTokenDeployResult> {
  const asset = await getAdminAsset(projectId);
  if (!asset) {
    return { status: 'NOT_FOUND' };
  }

  if (asset.contractAddress) {
    return {
      status: 'ALREADY_DEPLOYED',
      asset,
      explorerUrl: buildSmartContractDocUrl(asset.chainId, asset.contractAddress) ?? asset.contractAddress,
      vaultExplorerUrl: asset.vaultAddress
        ? buildSmartContractDocUrl(asset.chainId, asset.vaultAddress)
        : null
    };
  }

  await updateAdminAsset(projectId, { tokenDeployStatus: 'PENDING' });

  try {
    const result = await deployLaunchToken({
      tokenStandard: asset.tokenStandard,
      tokenInstrumentType: asset.tokenInstrumentType,
      tokenName: asset.tokenName ?? asset.title,
      tokenSymbol: asset.tokenSymbol ?? 'RWA',
      totalSupplyUnits: asset.totalTokens
    });

    if (result.status === 'DEPLOYED') {
      const explorerUrl = buildSmartContractDocUrl(result.chainId, result.contractAddress) ?? result.contractAddress;
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

      let collateral = null;
      if (updated?.collateralTargets.length) {
        const { registerProjectCollateral } = await import('../collateral/collateralOrchestrator');
        collateral = await registerProjectCollateral(projectId);
      }

      return {
        status: 'DEPLOYED',
        asset: collateral?.updatedAsset ?? updated!,
        txHash: result.txHash,
        explorerUrl,
        vaultExplorerUrl,
        collateral
      };
    }

    const updated = await updateAdminAsset(projectId, { tokenDeployStatus: 'SKIPPED' });
    return { status: 'SKIPPED', asset: updated, reason: result.reason };
  } catch (error) {
    await updateAdminAsset(projectId, { tokenDeployStatus: 'FAILED' });
    const reason = error instanceof Error ? error.message : 'Token deployment failed';
    return { status: 'FAILED', reason };
  }
}
