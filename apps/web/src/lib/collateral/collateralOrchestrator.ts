import { appendDeploymentEvent, getAdminAsset, updateAdminAsset, withProjectAutomationLock } from '../admin/assetsService';
import { shouldBlockAutomation } from '../admin/automationCircuitBreaker';
import type { CollateralProtocol, CollateralTarget } from '../admin/launchTypes';
import { runCollateralAdapter } from './collateralAdapters';
import {
  COLLATERAL_PROTOCOLS,
  evaluateCollateralReadiness,
  getProtocolDefinition,
  protocolCredentialsConfigured,
  type CollateralProjectContext
} from './collateralRegistry';
import { mergeCollateralTargets } from './collateralTargetsService';

export type CollateralRegistrationOutcome = {
  protocol: CollateralProtocol;
  target: CollateralTarget;
};

export type CollateralRegistrationSummary = {
  projectId: string;
  outcomes: CollateralRegistrationOutcome[];
  updatedAsset: Awaited<ReturnType<typeof getAdminAsset>>;
};

function toProjectContext(asset: NonNullable<Awaited<ReturnType<typeof getAdminAsset>>>): CollateralProjectContext {
  return {
    id: asset.id,
    title: asset.title,
    tokenName: asset.tokenName,
    tokenSymbol: asset.tokenSymbol,
    tokenStandard: asset.tokenStandard,
    tokenInstrumentType: asset.tokenInstrumentType,
    maturityDate: asset.maturityDate,
    tokenDeployStatus: asset.tokenDeployStatus,
    contractAddress: asset.contractAddress,
    vaultAddress: asset.vaultAddress,
    chainId: asset.chainId,
    totalTokens: asset.totalTokens,
    pricePerToken: asset.pricePerToken,
    spvEntityName: asset.spvEntityName,
    navOracleUrl: asset.navOracleUrl,
    jurisdiction: asset.jurisdiction,
    centrifugeChecklist: asset.centrifugeChecklist,
    contracts: asset.contracts,
    collateralTargets: asset.collateralTargets
  };
}

function buildTargetFromReadiness(
  project: CollateralProjectContext,
  protocol: CollateralProtocol,
  existing?: CollateralTarget
): CollateralTarget {
  const readiness = evaluateCollateralReadiness(project, protocol);

  if (existing?.status === 'REGISTERED') {
    return {
      ...existing,
      readinessScore: readiness.score,
      missingRequirements: readiness.missing
    };
  }

  return {
    protocol,
    status: readiness.ready ? (existing?.status ?? 'READY') : 'BLOCKED',
    readinessScore: readiness.score,
    missingRequirements: readiness.missing,
    externalId: existing?.externalId ?? null,
    poolUrl: existing?.poolUrl ?? null,
    oracleAddress: existing?.oracleAddress ?? null,
    notes: existing?.notes,
    lastError: readiness.ready ? null : 'REQUIREMENTS_NOT_MET',
    submittedAt: existing?.submittedAt ?? null,
    registeredAt: existing?.registeredAt ?? null
  };
}

export { mergeCollateralTargets } from './collateralTargetsService';

export async function refreshCollateralReadiness(projectId: string): Promise<CollateralRegistrationSummary | null> {
  const asset = await getAdminAsset(projectId);
  if (!asset) {
    return null;
  }

  const blockReason = shouldBlockAutomation(asset);
  if (blockReason) {
    await appendDeploymentEvent(projectId, {
      step: 'CIRCUIT_BREAKER',
      status: 'SKIPPED',
      message: `Registro de colateral omitido: ${blockReason}`
    });
    return { projectId, outcomes: [], updatedAsset: asset };
  }

  const project = toProjectContext(asset);
  const protocols = asset.collateralTargets.map((t) => t.protocol);

  if (!protocols.length) {
    return { projectId, outcomes: [], updatedAsset: asset };
  }

  const targets = mergeCollateralTargets(project, protocols);
  const updatedAsset = await updateAdminAsset(projectId, {
    collateralTargets: targets
  });

  return {
    projectId,
    outcomes: targets.map((target) => ({ protocol: target.protocol, target })),
    updatedAsset
  };
}

export async function registerProjectCollateral(
  projectId: string,
  protocolFilter?: CollateralProtocol[],
  options: { skipLock?: boolean } = {}
): Promise<CollateralRegistrationSummary | null> {
  if (!options.skipLock) {
    return withProjectAutomationLock(projectId, 'COLLATERAL_REGISTER', () =>
      registerProjectCollateral(projectId, protocolFilter, { skipLock: true })
    );
  }

  const asset = await getAdminAsset(projectId);
  if (!asset) {
    return null;
  }

  const project = toProjectContext(asset);
  const protocols =
    protocolFilter?.length ?
      protocolFilter
    : asset.collateralTargets.map((t) => t.protocol);

  if (!protocols.length) {
    return { projectId, outcomes: [], updatedAsset: asset };
  }

  const existingMap = new Map(asset.collateralTargets.map((t) => [t.protocol, t]));
  const outcomes: CollateralRegistrationOutcome[] = [];

  for (const protocol of protocols) {
    const existing = existingMap.get(protocol);

    if (existing?.status === 'REGISTERED') {
      outcomes.push({ protocol, target: existing });
      continue;
    }

    const readiness = evaluateCollateralReadiness(project, protocol);
    let target: CollateralTarget = buildTargetFromReadiness(project, protocol, existing);

    if (!readiness.ready) {
      outcomes.push({ protocol, target });
      continue;
    }

    target = { ...target, status: 'SUBMITTING' };
    const result = await runCollateralAdapter(project, protocol);

    target = {
      ...target,
      status: result.status,
      externalId: result.externalId ?? target.externalId ?? null,
      poolUrl: result.poolUrl ?? target.poolUrl ?? null,
      oracleAddress: result.oracleAddress ?? target.oracleAddress ?? null,
      notes: result.notes ?? target.notes,
      lastError: result.lastError ?? null,
      readinessScore: readiness.score,
      missingRequirements: readiness.missing,
      submittedAt:
        result.status === 'SUBMITTED' || result.status === 'REGISTERED' ?
          new Date().toISOString()
        : target.submittedAt ?? null,
      registeredAt: result.status === 'REGISTERED' ? new Date().toISOString() : target.registeredAt ?? null
    };

    outcomes.push({ protocol, target });

    await appendDeploymentEvent(projectId, {
      step: protocol === 'MORPHO' ? 'MORPHO_MARKET' : 'COLLATERAL_REGISTER',
      status:
        result.status === 'REGISTERED' || result.status === 'SUBMITTED'
          ? 'SUCCESS'
          : result.status === 'READY'
            ? 'SKIPPED'
            : 'FAILED',
      message: result.notes ?? `${protocol}: ${result.status}`,
      address: result.oracleAddress ?? target.poolUrl ?? null,
      externalId: result.externalId ?? null
    });
  }

  const updatedAsset = await updateAdminAsset(projectId, {
    collateralTargets: outcomes.map((o) => o.target)
  });

  if (updatedAsset?.collateralTargets.some((target) => target.protocol === 'MORPHO' && target.status === 'REGISTERED')) {
    const { checkMorphoLiquidity } = await import('../lending/morphoLiquidityCheck');
    await checkMorphoLiquidity(updatedAsset);
  }

  return { projectId, outcomes, updatedAsset };
}

export function getCollateralIntegrationStatus() {
  return COLLATERAL_PROTOCOLS.map((def) => ({
    id: def.id,
    name: def.name,
    category: def.category,
    docsUrl: def.docsUrl,
    institutionalReview: def.institutionalReview,
    credentialsConfigured: protocolCredentialsConfigured(def),
    credentialKeys: def.envCredentialKeys,
    requiresErc4626: def.requiresErc4626,
    minTokenSupply: def.minTokenSupply,
    supportedChainIds: def.supportedChainIds
  }));
}

export { evaluateCollateralReadiness, getProtocolDefinition, COLLATERAL_PROTOCOLS };
