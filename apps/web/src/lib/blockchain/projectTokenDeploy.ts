import type { AdminAssetRecord } from '../admin/assetsService';
import { getAdminAsset, updateAdminAsset } from '../admin/assetsService';
import { buildSmartContractDocUrl } from './explorerUrls';
import { deployLaunchToken } from './deployLaunchToken';
import { deployVaultForExistingToken } from './deployVaultOnly';

export type ProjectVaultDeployResult =
  | {
      status: 'DEPLOYED';
      asset: AdminAssetRecord;
      vaultAddress: string;
      vaultExplorerUrl: string;
      txHash: string;
      collateral: Awaited<ReturnType<typeof import('../collateral/collateralOrchestrator').registerProjectCollateral>> | null;
    }
  | { status: 'ALREADY_HAS_VAULT'; asset: AdminAssetRecord; vaultExplorerUrl: string }
  | { status: 'SKIPPED'; asset: AdminAssetRecord | null; reason: string }
  | { status: 'NOT_FOUND' }
  | { status: 'FAILED'; reason: string };

export async function executeProjectVaultDeploy(projectId: string): Promise<ProjectVaultDeployResult> {
  const asset = await getAdminAsset(projectId);
  if (!asset) {
    return { status: 'NOT_FOUND' };
  }

  if (!asset.contractAddress) {
    return { status: 'SKIPPED', asset, reason: 'Primero debe existir el token (contractAddress).' };
  }

  if (asset.vaultAddress) {
    const vaultExplorerUrl =
      buildSmartContractDocUrl(asset.chainId, asset.vaultAddress) ?? asset.vaultAddress;
    return { status: 'ALREADY_HAS_VAULT', asset, vaultExplorerUrl };
  }

  if (asset.tokenStandard !== 'ERC4626') {
    return { status: 'SKIPPED', asset, reason: 'El activo no usa estándar ERC4626.' };
  }

  const result = await deployVaultForExistingToken({
    contractAddress: asset.contractAddress,
    tokenName: asset.tokenName ?? asset.title,
    tokenSymbol: asset.tokenSymbol ?? 'RWA',
    totalSupplyUnits: asset.totalTokens
  });

  if (result.status !== 'DEPLOYED') {
    return { status: 'SKIPPED', asset, reason: result.reason };
  }

  const vaultExplorerUrl =
    buildSmartContractDocUrl(result.chainId, result.vaultAddress) ?? result.vaultAddress;

  const updated = await updateAdminAsset(projectId, {
    vaultAddress: result.vaultAddress,
    chainId: result.chainId,
    tokenDeployStatus: 'DEPLOYED',
    contracts: {
      smartContract: vaultExplorerUrl
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
    vaultAddress: result.vaultAddress,
    vaultExplorerUrl,
    txHash: result.txHash,
    collateral
  };
}

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
    if (asset.tokenStandard === 'ERC4626' && !asset.vaultAddress) {
      const vaultResult = await executeProjectVaultDeploy(projectId);
      if (vaultResult.status === 'DEPLOYED') {
        return {
          status: 'DEPLOYED',
          asset: vaultResult.asset,
          txHash: vaultResult.txHash,
          explorerUrl:
            buildSmartContractDocUrl(asset.chainId, asset.contractAddress) ?? asset.contractAddress,
          vaultExplorerUrl: vaultResult.vaultExplorerUrl,
          collateral: vaultResult.collateral
        };
      }
    }

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
      let vaultAddress = result.vaultAddress ?? null;
      let vaultExplorerUrl = vaultAddress
        ? buildSmartContractDocUrl(result.chainId, vaultAddress)
        : null;

      const updated = await updateAdminAsset(projectId, {
        tokenDeployStatus: 'DEPLOYED',
        contractAddress: result.contractAddress,
        vaultAddress,
        chainId: result.chainId,
        contracts: {
          smartContract: vaultExplorerUrl ?? explorerUrl
        }
      });

      let finalAsset = updated;
      let collateral = null;

      if (asset.tokenStandard === 'ERC4626' && !vaultAddress) {
        const vaultResult = await executeProjectVaultDeploy(projectId);
        if (vaultResult.status === 'DEPLOYED') {
          finalAsset = vaultResult.asset;
          vaultAddress = vaultResult.vaultAddress;
          vaultExplorerUrl = vaultResult.vaultExplorerUrl;
          collateral = vaultResult.collateral;
        }
      } else if (updated?.collateralTargets.length) {
        const { registerProjectCollateral } = await import('../collateral/collateralOrchestrator');
        collateral = await registerProjectCollateral(projectId);
        finalAsset = collateral?.updatedAsset ?? updated;
      }

      if (!collateral && updated?.collateralTargets.length && vaultAddress) {
        const { registerProjectCollateral } = await import('../collateral/collateralOrchestrator');
        collateral = await registerProjectCollateral(projectId);
        finalAsset = collateral?.updatedAsset ?? finalAsset;
      }

      return {
        status: 'DEPLOYED',
        asset: finalAsset!,
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
