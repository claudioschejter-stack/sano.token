import type { AdminAssetRecord, CreateAdminAssetInput, UpdateAdminAssetInput } from './assetsService';
import { getAdminAsset, updateAdminAsset } from './assetsService';
import { executeProjectTokenDeploy } from '../blockchain/projectTokenDeploy';
import { ensureVaultCollateralProtocols } from './emissionProfiles';
import {
  enqueueErc4626DeployPipeline,
  shouldUseAsyncErc4626Deploy,
  completeErc4626LaunchPostDeploy
} from './erc4626LaunchPipeline';
import { validateErc4626MorphoFormRequirements } from './erc4626MorphoGate';
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
    chainId: 'chainId' in body ? body.chainId : existing?.chainId,
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
      async?: boolean;
      jobIds?: string[];
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
    if (shouldUseAsyncErc4626Deploy()) {
      const queued = await enqueueErc4626DeployPipeline(projectId, {
        requestedPublish: options.requestedPublish
      });
      asset = (await getAdminAsset(projectId)) ?? asset;
      return { ok: true, asset, async: true, jobIds: queued.jobIds };
    }

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

  return completeErc4626LaunchPostDeploy(projectId, options);
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
    collateralProtocols: ensureVaultCollateralProtocols(
      stripped.collateralProtocols,
      standard
    )
  };
}

export function sanitizeErc4626CreateBody(body: CreateAdminAssetInput): CreateAdminAssetInput {
  if (!isErc4626Standard(body.tokenStandard)) {
    return body;
  }

  return {
    ...stripClientOnChainFieldsForErc4626(body, body.tokenStandard),
    collateralProtocols: ensureVaultCollateralProtocols(body.collateralProtocols, body.tokenStandard),
    deployToken: true,
    isActive: false
  } as CreateAdminAssetInput;
}
