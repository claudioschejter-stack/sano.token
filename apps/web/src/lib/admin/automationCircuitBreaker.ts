import type { AdminAssetRecord } from './assetsService';
import { appendDeploymentEvent, updateAdminAsset } from './assetsService';
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
  await notifyCircuitBreaker(projectId, asset?.title ?? projectId, reason);
  return asset;
}
