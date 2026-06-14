import {
  appendDeploymentEvent,
  getAdminAsset,
  updateAdminAsset,
  type AdminAssetRecord
} from './assetsService';
import { enqueueAutomationJob, processAutomationJobs, isAutomationJobTableAvailable } from './automationJobs';
import {
  getErc4626OnChainIssues,
  isErc4626OnChainReady,
  isErc4626Standard,
  mergeLaunchGateIssues
} from './erc4626LaunchGate';
import { getMorphoPostDeployIssues, getTreasuryReadinessIssues } from './erc4626MorphoGate';
import type { Erc4626SavePipelineResult } from './erc4626LaunchSave';
import { autoCollateralProtocolsForAsset } from './emissionProfiles';
import type { CollateralProtocol } from './launchTypes';

export const ERC4626_LAUNCH_PIPELINE = 'ERC4626_LAUNCH';

export function shouldUseAsyncErc4626Deploy(): boolean {
  return process.env.AUTOMATION_ASYNC_DEPLOY !== 'false';
}

export async function enqueueErc4626DeployPipeline(
  projectId: string,
  options: { requestedPublish: boolean }
): Promise<{
  jobIds: string[];
  async: true;
  tableAvailable: boolean;
  warning?: 'AUTOMATION_JOB_TABLE_MISSING';
}> {
  await updateAdminAsset(projectId, { tokenDeployStatus: 'PENDING' });
  await appendDeploymentEvent(projectId, {
    step: 'TOKEN_DEPLOY',
    status: 'PENDING',
    message: 'Pipeline ERC-4626 encolado (deploy asíncrono).',
    externalId: 'ERC4626_LAUNCH_PIPELINE'
  });

  const payload = {
    pipeline: ERC4626_LAUNCH_PIPELINE,
    requestedPublish: options.requestedPublish,
    adminAuthorized: true
  };

  const tokenJob = await enqueueAutomationJob({
    projectId,
    step: 'TOKEN_DEPLOY',
    payload
  });

  const tableAvailable = isAutomationJobTableAvailable();
  const jobIds = tokenJob?.id ? [tokenJob.id] : [];

  if (!tableAvailable || !tokenJob?.id) {
    await appendDeploymentEvent(projectId, {
      step: 'TOKEN_DEPLOY',
      status: 'FAILED',
      message:
        'No se encoló el deploy: la tabla AutomationJob no está disponible. Aplicá el schema Prisma y redeployá.',
      externalId: 'AUTOMATION_JOB_TABLE_MISSING'
    });
    return { jobIds: [], async: true, tableAvailable: false, warning: 'AUTOMATION_JOB_TABLE_MISSING' };
  }

  void processAutomationJobs(3).catch((error) => {
    console.warn('[erc4626LaunchPipeline] background job kick failed:', error);
  });

  return { jobIds, async: true, tableAvailable: true };
}

function collateralProtocolsNeedingRegistration(
  asset: AdminAssetRecord,
  protocols: CollateralProtocol[]
): CollateralProtocol[] {
  const existing = new Map(asset.collateralTargets.map((target) => [target.protocol, target]));

  return protocols.filter((protocol) => {
    const target = existing.get(protocol);
    if (protocol === 'MORPHO') {
      return !(target?.status === 'REGISTERED' && target.oracleAddress);
    }
    return target?.status !== 'REGISTERED' && target?.status !== 'SUBMITTED';
  });
}

async function ensureAutoCollateralRegistered(projectId: string): Promise<AdminAssetRecord | null> {
  const asset = await getAdminAsset(projectId);
  if (!asset) return null;

  const protocols = autoCollateralProtocolsForAsset(asset);
  const pending = collateralProtocolsNeedingRegistration(asset, protocols);
  if (!pending.length) {
    return asset;
  }

  const { registerProjectCollateral } = await import('../collateral/collateralOrchestrator');
  const summary = await registerProjectCollateral(projectId, pending, { skipLock: true });
  return summary?.updatedAsset ?? (await getAdminAsset(projectId));
}

/** Post-deploy Morpho, treasury repair, and publish gates (sync or LAUNCH_FINALIZE job). */
export async function completeErc4626LaunchPostDeploy(
  projectId: string,
  options: { requestedPublish: boolean }
): Promise<Erc4626SavePipelineResult> {
  let asset = await getAdminAsset(projectId);
  if (!asset || !isErc4626Standard(asset.tokenStandard)) {
    return asset ? { ok: true, asset } : { ok: false, issues: [{ code: 'DEPLOY_FAILED', detail: 'NOT_FOUND' }] };
  }

  asset = (await ensureAutoCollateralRegistered(projectId)) ?? asset;

  const { repairTreasuryVaultShares } = await import('../blockchain/repairTreasuryVaultShares');
  const treasuryRepair = await repairTreasuryVaultShares(asset);
  if (treasuryRepair.ok) {
    await appendDeploymentEvent(projectId, {
      step: 'VAULT_FUNDING',
      status: 'SUCCESS',
      message: treasuryRepair.message,
      txHash: treasuryRepair.txHash ?? null
    });
  } else if (asset.vaultAddress) {
    await appendDeploymentEvent(projectId, {
      step: 'VAULT_FUNDING',
      status: 'FAILED',
      message: treasuryRepair.message
    });
  }

  const onChainIssues = getErc4626OnChainIssues(asset);
  const morphoIssues = options.requestedPublish ? getMorphoPostDeployIssues(asset) : [];
  const treasuryIssues = options.requestedPublish ? await getTreasuryReadinessIssues(asset) : [];
  const allIssues = mergeLaunchGateIssues(onChainIssues, morphoIssues, treasuryIssues);

  if (allIssues.length) {
    if (options.requestedPublish) {
      await updateAdminAsset(projectId, { isActive: false });
    }
    return { ok: false, issues: allIssues };
  }

  if (options.requestedPublish && !isErc4626OnChainReady(asset)) {
    await updateAdminAsset(projectId, { isActive: false });
    return {
      ok: false,
      issues: [{ code: 'CANNOT_PUBLISH_INCOMPLETE' }, ...getErc4626OnChainIssues(asset)]
    };
  }

  if (options.requestedPublish) {
    const published = await updateAdminAsset(projectId, { isActive: true });
    asset = published ?? asset;
  }

  return { ok: true, asset };
}

export async function chainErc4626PipelineAfterTokenDeploy(
  projectId: string,
  payload: Record<string, unknown> | null | undefined
): Promise<void> {
  if (payload?.pipeline !== ERC4626_LAUNCH_PIPELINE) {
    return;
  }

  const requestedPublish = Boolean(payload?.requestedPublish);
  const now = new Date();
  const asset = await getAdminAsset(projectId);
  const protocols = asset ? autoCollateralProtocolsForAsset(asset) : ['MORPHO'];

  await enqueueAutomationJob({
    projectId,
    step: 'COLLATERAL_REGISTER',
    payload: { pipeline: ERC4626_LAUNCH_PIPELINE, requestedPublish, protocols },
    runAfter: now
  });
  await enqueueAutomationJob({
    projectId,
    step: 'EXPLORER_VERIFY',
    payload: { pipeline: ERC4626_LAUNCH_PIPELINE, requestedPublish },
    runAfter: new Date(now.getTime() + 5_000)
  });
}
