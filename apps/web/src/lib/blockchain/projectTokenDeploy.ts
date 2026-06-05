import type { AdminAssetRecord } from '../admin/assetsService';
import {
  appendDeploymentEvent,
  clearAutomationFailures,
  getAdminAsset,
  noteAutomationFailure,
  updateAdminAsset,
  withProjectAutomationLock
} from '../admin/assetsService';
import { buildSmartContractDocUrl } from './explorerUrls';
import { deployLaunchToken } from './deployLaunchToken';
import { assertTreasuryVaultSharesReady } from './verifyTreasuryVaultShares';
import { deployVaultForExistingToken } from './deployVaultOnly';
import { recordExplorerVerification } from './contractVerification';
import { recordAutomationPreflight } from './automationPreflight';
import { shouldBlockAutomation } from '../admin/automationCircuitBreaker';
import type { OwnershipTransferResult } from './ownershipTransfer';
import { logAutomationEvent } from '../admin/automationLogger';

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

async function recordOwnershipTransfers(projectId: string, transfers?: OwnershipTransferResult[]) {
  if (!transfers?.length) return;

  for (const transfer of transfers) {
    await appendDeploymentEvent(projectId, {
      step: 'OWNERSHIP_TRANSFER',
      status:
        transfer.status === 'TRANSFERRED' || transfer.status === 'ALREADY_TREASURY'
          ? 'SUCCESS'
          : transfer.status === 'SKIPPED'
            ? 'SKIPPED'
            : 'FAILED',
      message:
        transfer.message ??
        `${transfer.contractName}: ${transfer.status} hacia treasury ${transfer.treasuryAddress}.`,
      txHash: transfer.txHash ?? null,
      address: transfer.contractAddress
    });
  }
}

async function executeProjectVaultDeployUnlocked(projectId: string): Promise<ProjectVaultDeployResult> {
  const asset = await getAdminAsset(projectId);
  if (!asset) {
    return { status: 'NOT_FOUND' };
  }

  const blockReason = shouldBlockAutomation(asset);
  if (blockReason) {
    return { status: 'SKIPPED', asset, reason: blockReason };
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

  let vaultDeployStatus: 'DEPLOYED' | 'FAILED' = result.vaultFundingStatus === 'FUNDED' ? 'DEPLOYED' : 'FAILED';
  let vaultFundingError = result.vaultFundingError;
  if (vaultDeployStatus === 'DEPLOYED') {
    const treasuryReady = await assertTreasuryVaultSharesReady({
      vaultAddress: result.vaultAddress,
      contractAddress: asset.contractAddress,
      chainId: result.chainId
    });
    if (treasuryReady.ok === false) {
      vaultDeployStatus = 'FAILED';
      vaultFundingError = treasuryReady.reason;
    }
  }

  const updated = await updateAdminAsset(projectId, {
    vaultAddress: result.vaultAddress,
    chainId: result.chainId,
    tokenDeployStatus: vaultDeployStatus,
    vaultFundingStatus: result.vaultFundingStatus,
    vaultFundingAmount: result.vaultFundingAmount,
    vaultFundingTxHash: result.vaultFundingTxHash,
    vaultFundingError,
    contracts: {
      smartContract: vaultExplorerUrl
    }
  });

  if (vaultDeployStatus !== 'DEPLOYED') {
    await appendDeploymentEvent(projectId, {
      step: 'VAULT_FUNDING',
      status: 'FAILED',
      message: vaultFundingError ?? 'Treasury vault shares missing after vault deploy.'
    });
    return { status: 'SKIPPED', asset: updated, reason: vaultFundingError ?? 'Treasury vault shares missing.' };
  }

  await appendDeploymentEvent(projectId, {
    step: 'VAULT_DEPLOY',
    status: 'SUCCESS',
    message: `Vault ERC-4626 desplegado en ${result.vaultAddress}.`,
    txHash: result.txHash,
    address: result.vaultAddress
  });
  await recordOwnershipTransfers(projectId, result.ownershipTransfers);
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
    collateral = await registerProjectCollateral(projectId, undefined, { skipLock: true });
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

export async function executeProjectVaultDeploy(
  projectId: string,
  options: { skipLock?: boolean } = {}
): Promise<ProjectVaultDeployResult> {
  const run = () => executeProjectVaultDeployUnlocked(projectId);
  if (options.skipLock) return run();

  try {
    return await withProjectAutomationLock(projectId, 'VAULT_DEPLOY', run);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Vault deploy locked';
    await noteAutomationFailure(projectId, reason);
    return { status: 'FAILED', reason };
  }
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

async function executeProjectTokenDeployUnlocked(projectId: string): Promise<ProjectTokenDeployResult> {
  logAutomationEvent({ event: 'token_deploy.start', projectId, step: 'TOKEN_DEPLOY', status: 'RUNNING' });
  const asset = await getAdminAsset(projectId);
  if (!asset) {
    return { status: 'NOT_FOUND' };
  }

  const blockReason = shouldBlockAutomation(asset);
  if (blockReason) {
    return { status: 'SKIPPED', asset, reason: blockReason };
  }

  const preflight = await recordAutomationPreflight(projectId, asset);
  if (!preflight.ok) {
    const failedChecks = preflight.checks
      .filter((check) => !check.ok)
      .map((check) => `${check.label}: ${check.detail}`)
      .join(' | ');
    return {
      status: 'SKIPPED',
      asset,
      reason: `Preflight automático falló (${failedChecks || 'revisá el historial de eventos'}).`
    };
  }

  if (asset.contractAddress) {
    if (asset.tokenStandard === 'ERC4626' && !asset.vaultAddress) {
      const vaultResult = await executeProjectVaultDeploy(projectId, { skipLock: true });
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

      let tokenDeployStatus: 'DEPLOYED' | 'FAILED' = 'DEPLOYED';
      let vaultFundingError = result.vaultFundingError ?? null;

      if (asset.tokenStandard === 'ERC4626') {
        if (result.vaultFundingStatus !== 'FUNDED' || !vaultAddress) {
          tokenDeployStatus = 'FAILED';
        } else {
          const treasuryReady = await assertTreasuryVaultSharesReady({
            vaultAddress,
            contractAddress: result.contractAddress,
            chainId: result.chainId
          });
          if (treasuryReady.ok === false) {
            tokenDeployStatus = 'FAILED';
            vaultFundingError = treasuryReady.reason;
          }
        }
      }

      const updated = await updateAdminAsset(projectId, {
        tokenDeployStatus,
        contractAddress: result.contractAddress,
        vaultAddress,
        vaultFundingStatus:
          asset.tokenStandard === 'ERC4626'
            ? result.vaultFundingStatus ?? 'FAILED'
            : 'NOT_REQUIRED',
        vaultFundingAmount: result.vaultFundingAmount ?? null,
        vaultFundingTxHash: result.vaultFundingTxHash ?? null,
        vaultFundingError,
        chainId: result.chainId,
        contracts: {
          smartContract: vaultExplorerUrl ?? explorerUrl
        }
      });

      if (tokenDeployStatus !== 'DEPLOYED') {
        await appendDeploymentEvent(projectId, {
          step: 'TOKEN_DEPLOY',
          status: 'FAILED',
          message: vaultFundingError ?? 'Treasury vault shares missing after deploy.'
        });
        return {
          status: 'SKIPPED',
          asset: updated,
          reason: vaultFundingError ?? 'Treasury vault shares missing after deploy.'
        };
      }

      await appendDeploymentEvent(projectId, {
        step: 'TOKEN_DEPLOY',
        status: 'SUCCESS',
        message: `Token desplegado en ${result.contractAddress}.`,
        txHash: result.txHash,
        address: result.contractAddress
      });
      await recordOwnershipTransfers(projectId, result.ownershipTransfers);
      await recordExplorerVerification(projectId, {
        contractAddress: result.contractAddress,
        contractName: 'SanovaAssetToken',
        chainId: result.chainId
      });
      await updateAdminAsset(projectId, { explorerVerificationStatus: 'PENDING' });
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
        const vaultResult = await executeProjectVaultDeploy(projectId, { skipLock: true });
        if (vaultResult.status === 'DEPLOYED') {
          finalAsset = vaultResult.asset;
          vaultAddress = vaultResult.vaultAddress;
          vaultExplorerUrl = vaultResult.vaultExplorerUrl;
          collateral = vaultResult.collateral;
        }
      } else if (updated?.collateralTargets.length) {
        const { registerProjectCollateral } = await import('../collateral/collateralOrchestrator');
        collateral = await registerProjectCollateral(projectId, undefined, { skipLock: true });
        finalAsset = collateral?.updatedAsset ?? updated;
      }

      if (!collateral && updated?.collateralTargets.length && vaultAddress) {
        const { registerProjectCollateral } = await import('../collateral/collateralOrchestrator');
        collateral = await registerProjectCollateral(projectId, undefined, { skipLock: true });
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

export async function executeProjectTokenDeploy(
  projectId: string,
  options: { skipLock?: boolean } = {}
): Promise<ProjectTokenDeployResult> {
  const run = async () => {
    const result = await executeProjectTokenDeployUnlocked(projectId);
    logAutomationEvent({
      level: result.status === 'FAILED' ? 'error' : result.status === 'SKIPPED' ? 'warn' : 'info',
      event: 'token_deploy.completed',
      projectId,
      step: 'TOKEN_DEPLOY',
      status: result.status,
      message: result.status === 'FAILED' || result.status === 'SKIPPED' ? result.reason : null
    });
    if (result.status === 'FAILED' || result.status === 'SKIPPED') {
      await noteAutomationFailure(projectId, result.reason);
    } else {
      await clearAutomationFailures(projectId);
    }
    return result;
  };

  if (options.skipLock) return run();

  try {
    return await withProjectAutomationLock(projectId, 'TOKEN_DEPLOY', run);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Token deploy locked';
    await noteAutomationFailure(projectId, reason);
    return { status: 'FAILED', reason };
  }
}

export async function executeProjectAutomationRepair(projectId: string) {
  return withProjectAutomationLock(projectId, 'REPAIR_AUTOMATION', async () => {
  await appendDeploymentEvent(projectId, {
    step: 'REPAIR_AUTOMATION',
    status: 'PENDING',
    message: 'Reparación automática solicitada.'
  });

  const deploy = await executeProjectTokenDeploy(projectId, { skipLock: true });
  const asset =
    deploy.status === 'DEPLOYED' || deploy.status === 'ALREADY_DEPLOYED'
      ? deploy.asset
      : await getAdminAsset(projectId);

  let collateral = null;
  if (asset?.collateralTargets.length && asset.contractAddress && (asset.tokenStandard !== 'ERC4626' || asset.vaultAddress)) {
    const { registerProjectCollateral } = await import('../collateral/collateralOrchestrator');
    collateral = await registerProjectCollateral(projectId, undefined, { skipLock: true });
  }

  const finalAsset = collateral?.updatedAsset ?? (await getAdminAsset(projectId));
  if (finalAsset?.collateralTargets.some((target) => target.protocol === 'MORPHO' && target.status === 'REGISTERED')) {
    const { checkMorphoLiquidity } = await import('../lending/morphoLiquidityCheck');
    await checkMorphoLiquidity(finalAsset);
  }
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

  if (deploy.status === 'FAILED' || deploy.status === 'SKIPPED') {
    await noteAutomationFailure(projectId, deploy.reason);
  } else {
    await clearAutomationFailures(projectId);
  }

  return { deploy, collateral, asset: finalAsset };
  });
}
