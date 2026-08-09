import type { AdminAssetRecord } from './assetsService';
import { appendDeploymentEvent, updateAdminAsset } from './assetsService';
import { assetAlertLabel } from './assetAlertLabel';
import { notifyCircuitBreaker } from './automationAlerts';

export function globalAutomationDisabled(): boolean {
  return process.env.AUTOMATION_DISABLED === '1' || process.env.AUTOMATION_DISABLED === 'true';
}

export function shouldBlockAutomation(asset: AdminAssetRecord): string | null {
  if (globalAutomationDisabled()) {
    return 'AUTOMATION_DISABLED está activo.';
  }
  if (asset.automationCircuitBreaker) {
    return 'Circuit breaker activo para este activo.';
  }
  if (asset.automationFailureCount >= 5) {
    return 'Demasiados fallos automáticos acumulados.';
  }
  return null;
}

export async function activateCircuitBreaker(projectId: string, reason: string) {
  await appendDeploymentEvent(projectId, {
    step: 'CIRCUIT_BREAKER',
    status: 'FAILED',
    message: `Circuit breaker activado: ${reason}`
  });
  const asset = await updateAdminAsset(projectId, { automationCircuitBreaker: true });
  await notifyCircuitBreaker(projectId, asset ? assetAlertLabel(asset) : projectId, reason);
  return asset;
}

/**
 * Clear the breaker once whatever tripped it is fixed.
 *
 * There was no way to do this. A breaker that can only be thrown is not a
 * breaker, it is a dead end: an asset stayed blocked from borrowing long after
 * the failure was resolved, and nothing in the product said why or how to undo
 * it.
 *
 * The accumulated failure count is cleared with it, because five past failures
 * block automation on their own and would trip the breaker again on the next
 * attempt.
 */
export async function resetCircuitBreaker(projectId: string, reason: string) {
  const asset = await updateAdminAsset(projectId, {
    automationCircuitBreaker: false,
    automationFailureCount: 0
  });

  await appendDeploymentEvent(projectId, {
    step: 'CIRCUIT_BREAKER',
    status: 'SUCCESS',
    message: `Circuit breaker liberado: ${reason}`
  });

  return asset;
}
