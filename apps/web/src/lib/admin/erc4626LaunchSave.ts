import type { AdminAssetRecord, CreateAdminAssetInput, UpdateAdminAssetInput } from './assetsService';
import { appendDeploymentEvent, getAdminAsset, updateAdminAsset } from './assetsService';
import { executeProjectTokenDeploy } from '../blockchain/projectTokenDeploy';
import type { CollateralProtocol } from './launchTypes';
import {
  getMorphoPostDeployIssues,
  getTreasuryReadinessIssues,
  validateErc4626MorphoFormRequirements
} from './erc4626MorphoGate';
import {
  deployResultToIssues,
  getDeployInfrastructureIssues,
  getErc4626OnChainIssues,
  isErc4626OnChainReady,
  isErc4626Standard,
  mergeLaunchGateIssues,
  needsErc4626Deploy,
  stripClientOnChainFieldsForErc4626,
  validateErc4626LaunchForm,
  type LaunchGateIssue
} from './erc4626LaunchGate';

function ensureMorphoCollateralProtocols(protocols: CollateralProtocol[] | undefined): CollateralProtocol[] {
  const set = new Set(protocols ?? []);
  set.add('MORPHO');
  return Array.from(set);
}

function formInputFromBody(
  body: CreateAdminAssetInput | UpdateAdminAssetInput,
  existing?: AdminAssetRecord | null
): Parameters<typeof validateErc4626LaunchForm>[0] {
  const collateralProtocols =
    'collateralProtocols' in body ? body.collateralProtocols : undefined;

  return {
    title: body.title ?? existing?.title,
    description: body.description ?? existing?.description,
    location: body.location ?? existing?.location,
    totalTokens: body.totalTokens ?? existing?.totalTokens,
    pricePerToken: body.pricePerToken ?? existing?.pricePerToken,
    tokenName: body.tokenName ?? existing?.tokenName,
    tokenSymbol: body.tokenSymbol ?? existing?.tokenSymbol,
    mediaGallery: body.mediaGallery ?? existing?.mediaGallery,
    isActive: body.isActive ?? existing?.isActive,
    collateralMorpho:
      collateralProtocols?.includes('MORPHO') ??
      existing?.collateralTargets.some((t) => t.protocol === 'MORPHO') ??
      true
  };
}

function morphoFormInputFromBody(
  body: CreateAdminAssetInput | UpdateAdminAssetInput,
  existing?: AdminAssetRecord | null
) {
  const collateralProtocols =
    'collateralProtocols' in body ? body.collateralProtocols : undefined;

  return {
    totalTokens: body.totalTokens ?? existing?.totalTokens,
    spvEntityName: body.spvEntityName ?? existing?.spvEntityName,
    navOracleUrl: body.navOracleUrl ?? existing?.navOracleUrl,
    jurisdiction: body.jurisdiction ?? existing?.jurisdiction,
    contracts: body.contracts ?? existing?.contracts,
    centrifugeChecklist: body.centrifugeChecklist ?? existing?.centrifugeChecklist,
    chainId: existing?.chainId,
    collateralMorpho:
      collateralProtocols?.includes('MORPHO') ??
      existing?.collateralTargets.some((t) => t.protocol === 'MORPHO') ??
      true
  };
}

export type Erc4626SavePipelineResult =
  | {
      ok: true;
      asset: AdminAssetRecord;
      deploy?: Awaited<ReturnType<typeof executeProjectTokenDeploy>>;
    }
  | { ok: false; issues: LaunchGateIssue[] };

export async function validateErc4626BeforePersist(
  body: CreateAdminAssetInput | UpdateAdminAssetInput,
  existing: AdminAssetRecord | null,
  options: { requireOnChain?: boolean } = {}
): Promise<LaunchGateIssue[]> {
  const standard = body.tokenStandard ?? existing?.tokenStandard;
  if (!isErc4626Standard(standard)) {
    return [];
  }

  const requireOnChain = options.requireOnChain ?? body.deployToken === true;

  return mergeLaunchGateIssues(
    validateErc4626LaunchForm(formInputFromBody(body, existing)),
    validateErc4626MorphoFormRequirements(morphoFormInputFromBody(body, existing), existing),
    requireOnChain ? await getDeployInfrastructureIssues() : []
  );
}

async function ensureMorphoCollateralRegistered(projectId: string): Promise<AdminAssetRecord | null> {
  const asset = await getAdminAsset(projectId);
  if (!asset) return null;

  const morphoTarget = asset.collateralTargets.find((target) => target.protocol === 'MORPHO');
  if (morphoTarget?.status === 'REGISTERED' && morphoTarget.oracleAddress) {
    return asset;
  }

  const { registerProjectCollateral } = await import('../collateral/collateralOrchestrator');
  const summary = await registerProjectCollateral(projectId, ['MORPHO'], { skipLock: true });
  return summary?.updatedAsset ?? (await getAdminAsset(projectId));
}

export async function finalizeErc4626AfterPersist(
  projectId: string,
  options: { requestedPublish: boolean }
): Promise<Erc4626SavePipelineResult> {
  let asset = await getAdminAsset(projectId);
  if (!asset || !isErc4626Standard(asset.tokenStandard)) {
    return asset ? { ok: true, asset } : { ok: false, issues: [{ code: 'DEPLOY_FAILED', detail: 'NOT_FOUND' }] };
  }

  let deploy: Awaited<ReturnType<typeof executeProjectTokenDeploy>> | undefined;

  if (needsErc4626Deploy(asset)) {
    deploy = await executeProjectTokenDeploy(projectId);
    asset =
      deploy.status === 'DEPLOYED' || deploy.status === 'ALREADY_DEPLOYED'
        ? (deploy.asset ?? (await getAdminAsset(projectId))!)
        : asset;

    const deployIssues = deployResultToIssues(
      deploy.status,
      deploy.status === 'SKIPPED' || deploy.status === 'FAILED' ? deploy.reason : undefined
    );

    if (deployIssues.length) {
      if (options.requestedPublish) {
        await updateAdminAsset(projectId, { isActive: false });
      }
      return {
        ok: false,
        issues: mergeLaunchGateIssues(deployIssues, getErc4626OnChainIssues(asset))
      };
    }
  }

  asset = (await ensureMorphoCollateralRegistered(projectId)) ?? asset;

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

  return { ok: true, asset, deploy };
}

const LAUNCH_CARD_PARTIAL_UPDATE_KEYS = new Set<keyof UpdateAdminAssetInput>([
  'mediaGallery',
  'image',
  'contracts'
]);

/** Media/contracts saves should not trigger ERC-4626 deploy or publish gates. */
export function isLaunchCardPartialUpdate(body: UpdateAdminAssetInput): boolean {
  const keys = Object.keys(body) as Array<keyof UpdateAdminAssetInput>;
  return keys.length > 0 && keys.every((key) => LAUNCH_CARD_PARTIAL_UPDATE_KEYS.has(key));
}

export function sanitizeErc4626UpdateBody(
  body: UpdateAdminAssetInput,
  existing: AdminAssetRecord
): UpdateAdminAssetInput {
  const standard = body.tokenStandard ?? existing.tokenStandard;
  const stripped = stripClientOnChainFieldsForErc4626(body, standard) as UpdateAdminAssetInput;

  if (!isErc4626Standard(standard)) {
    return stripped;
  }

  return {
    ...stripped,
    collateralProtocols: ensureMorphoCollateralProtocols(stripped.collateralProtocols)
  };
}

export function sanitizeErc4626CreateBody(body: CreateAdminAssetInput): CreateAdminAssetInput {
  if (!isErc4626Standard(body.tokenStandard)) {
    return body;
  }

  return {
    ...stripClientOnChainFieldsForErc4626(body, body.tokenStandard),
    collateralProtocols: ensureMorphoCollateralProtocols(body.collateralProtocols),
    deployToken: true,
    isActive: false
  } as CreateAdminAssetInput;
}
