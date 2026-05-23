import type { CollateralProtocol, CollateralTarget } from '../admin/launchTypes';
import { evaluateCollateralReadiness, type CollateralProjectContext } from './collateralRegistry';

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
    notes: existing?.notes,
    lastError: readiness.ready ? null : 'REQUIREMENTS_NOT_MET',
    submittedAt: existing?.submittedAt ?? null,
    registeredAt: existing?.registeredAt ?? null
  };
}

export function mergeCollateralTargets(
  project: CollateralProjectContext,
  selectedProtocols: CollateralProtocol[]
): CollateralTarget[] {
  const existingMap = new Map(
    (project.collateralTargets ?? []).map((target) => [target.protocol, target])
  );

  return selectedProtocols.map((protocol) =>
    buildTargetFromReadiness(project, protocol, existingMap.get(protocol))
  );
}

export function buildInitialCollateralTargets(
  project: CollateralProjectContext,
  protocols: CollateralProtocol[] | undefined
): CollateralTarget[] {
  if (!protocols?.length) {
    return [];
  }

  return mergeCollateralTargets(project, protocols);
}
