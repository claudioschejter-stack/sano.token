import type { AdminAssetRecord, CreateAdminAssetInput, UpdateAdminAssetInput } from './assetsService';
import { getAdminAsset, updateAdminAsset } from './assetsService';
import { executeProjectTokenDeploy } from '../blockchain/projectTokenDeploy';
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
      false
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
  existing: AdminAssetRecord | null
): Promise<LaunchGateIssue[]> {
  const standard = body.tokenStandard ?? existing?.tokenStandard;
  if (!isErc4626Standard(standard)) {
    return [];
  }

  return mergeLaunchGateIssues(
    validateErc4626LaunchForm(formInputFromBody(body, existing)),
    await getDeployInfrastructureIssues()
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

  asset = (await getAdminAsset(projectId))!;

  const onChainIssues = getErc4626OnChainIssues(asset);
  if (onChainIssues.length) {
    if (options.requestedPublish) {
      await updateAdminAsset(projectId, { isActive: false });
    }
    return { ok: false, issues: onChainIssues };
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

export function sanitizeErc4626UpdateBody(
  body: UpdateAdminAssetInput,
  existing: AdminAssetRecord
): UpdateAdminAssetInput {
  const standard = body.tokenStandard ?? existing.tokenStandard;
  return stripClientOnChainFieldsForErc4626(body, standard) as UpdateAdminAssetInput;
}

export function sanitizeErc4626CreateBody(body: CreateAdminAssetInput): CreateAdminAssetInput {
  if (!isErc4626Standard(body.tokenStandard)) {
    return body;
  }

  return {
    ...stripClientOnChainFieldsForErc4626(body, body.tokenStandard),
    deployToken: true,
    isActive: false
  } as CreateAdminAssetInput;
}
