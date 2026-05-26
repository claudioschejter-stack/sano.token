import type { AdminAssetRecord } from '../admin/assetsService';
import { appendDeploymentEvent, getAdminAsset, updateAdminAsset } from '../admin/assetsService';
import { buildSmartContractDocUrl } from './explorerUrls';
import { deployLaunchToken } from './deployLaunchToken';
import { deployVaultForExistingToken } from './deployVaultOnly';
import { recordExplorerVerification } from './contractVerification';

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
    await appendDeploymentEvent(projectId, {
      step: 'VAULT_DEPLOY',
      status: 'SKIPPED',
      message: result.reason
    });
    return { status: 'SKIPPED', asset, reason: result.reason };
  }

  const vaultExplorerUrl =
    buildSmartContractDocUrl(result.chainId, result.vaultAddress) ?? result.vaultAddress;

  const updated = await updateAdminAsset(projectId, {
    vaultAddress: result.vaultAddress,
    chainId: result.chainId,
    tokenDeployStatus: result.vaultFundingStatus === 'FUNDED' ? 'DEPLOYED' : 'FAILED',
    vaultFundingStatus: result.vaultFundingStatus,
    vaultFundingAmount: result.vaultFundingAmount,
    vaultFundingTxHash: result.vaultFundingTxHash,
    vaultFundingError: result.vaultFundingError,
    contracts: {
      smartContract: vaultExplorerUrl
    }
  });

  await appendDeploymentEvent(projectId, {
    step: 'VAULT_DEPLOY',
    status: 'SUCCESS',
    message: `Vault ERC-4626 desplegado en ${result.vaultAddress}.`,
    txHash: result.txHash,
    address: result.vaultAddress
  });
  await recordExplorerVerification(projectId, {
    contractAddress: result.vaultAddress,
    contractName: 'SanovaRwaVault',
    chainId: result.chainId
  });

  await appendDeploymentEvent(projectId, {
    step: 'VAULT_FUNDING',
    status: result.vaultFundingStatus === 'FUNDED' ? 'SUCCESS' : 'FAILED',
    message:
      result.vaultFundingStatus === 'FUNDED'
        ? `Vault fondeado con ${result.vaultFundingAmount} unidades base.`
        : result.vaultFundingError ?? 'No se pudo verificar el fondeo del vault.',
    txHash: result.vaultFundingTxHash
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
  await appendDeploymentEvent(projectId, {
    step: 'TOKEN_DEPLOY',
    status: 'PENDING',
    message: 'Iniciando emisión automática token/vault.'
  });

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
        tokenDeployStatus:
          asset.tokenStandard === 'ERC4626' && result.vaultFundingStatus !== 'FUNDED' ? 'FAILED' : 'DEPLOYED',
        contractAddress: result.contractAddress,
        vaultAddress,
        vaultFundingStatus:
          asset.tokenStandard === 'ERC4626'
            ? result.vaultFundingStatus ?? 'FAILED'
            : 'NOT_REQUIRED',
        vaultFundingAmount: result.vaultFundingAmount ?? null,
        vaultFundingTxHash: result.vaultFundingTxHash ?? null,
        vaultFundingError: result.vaultFundingError ?? null,
        chainId: result.chainId,
        contracts: {
          smartContract: vaultExplorerUrl ?? explorerUrl
        }
      });

      await appendDeploymentEvent(projectId, {
        step: 'TOKEN_DEPLOY',
        status: 'SUCCESS',
        message: `Token desplegado en ${result.contractAddress}.`,
        txHash: result.txHash,
        address: result.contractAddress
      });
      await recordExplorerVerification(projectId, {
        contractAddress: result.contractAddress,
        contractName: 'SanovaAssetToken',
        chainId: result.chainId
      });
      if (vaultAddress) {
        await recordExplorerVerification(projectId, {
          contractAddress: vaultAddress,
          contractName: 'SanovaRwaVault',
          chainId: result.chainId
        });
      }

      if (asset.tokenStandard === 'ERC4626') {
        await appendDeploymentEvent(projectId, {
          step: 'VAULT_FUNDING',
          status: result.vaultFundingStatus === 'FUNDED' ? 'SUCCESS' : 'FAILED',
          message:
            result.vaultFundingStatus === 'FUNDED'
              ? `Vault fondeado con ${result.vaultFundingAmount} unidades base.`
              : result.vaultFundingError ?? 'No se pudo verificar el fondeo del vault.',
          txHash: result.vaultFundingTxHash
        });
      }

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
    await appendDeploymentEvent(projectId, {
      step: 'TOKEN_DEPLOY',
      status: 'SKIPPED',
      message: result.reason
    });
    return { status: 'SKIPPED', asset: updated, reason: result.reason };
  } catch (error) {
    await updateAdminAsset(projectId, { tokenDeployStatus: 'FAILED' });
    const reason = error instanceof Error ? error.message : 'Token deployment failed';
    await appendDeploymentEvent(projectId, {
      step: 'TOKEN_DEPLOY',
      status: 'FAILED',
      message: reason
    });
    return { status: 'FAILED', reason };
  }
}

export async function executeProjectAutomationRepair(projectId: string) {
  await appendDeploymentEvent(projectId, {
    step: 'REPAIR_AUTOMATION',
    status: 'PENDING',
    message: 'Reparación automática solicitada.'
  });

  const deploy = await executeProjectTokenDeploy(projectId);
  const asset =
    deploy.status === 'DEPLOYED' || deploy.status === 'ALREADY_DEPLOYED'
      ? deploy.asset
      : await getAdminAsset(projectId);

  let collateral = null;
  if (asset?.collateralTargets.length && asset.contractAddress && (asset.tokenStandard !== 'ERC4626' || asset.vaultAddress)) {
    const { registerProjectCollateral } = await import('../collateral/collateralOrchestrator');
    collateral = await registerProjectCollateral(projectId);
  }

  const finalAsset = collateral?.updatedAsset ?? (await getAdminAsset(projectId));
  await appendDeploymentEvent(projectId, {
    step: 'REPAIR_AUTOMATION',
    status:
      deploy.status === 'FAILED' || deploy.status === 'SKIPPED'
        ? 'FAILED'
        : 'SUCCESS',
    message:
      deploy.status === 'FAILED' || deploy.status === 'SKIPPED'
        ? 'La reparación terminó con tareas pendientes. Revisá el detalle de eventos.'
        : 'Reparación automática finalizada.'
  });

  return { deploy, collateral, asset: finalAsset };
}
