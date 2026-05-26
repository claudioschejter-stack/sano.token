import type { AdminAssetRecord } from '../admin/assetsService';
import { appendDeploymentEvent } from '../admin/assetsService';
import { getTokenDeployStatus } from './tokenDeployConfig';
import { validateTreasuryPolicy } from './treasuryPolicy';

export type AutomationPreflightCheck = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
};

export type AutomationPreflightResult = {
  ok: boolean;
  checks: AutomationPreflightCheck[];
};

function check(key: string, label: string, ok: boolean, detail: string): AutomationPreflightCheck {
  return { key, label, ok, detail };
}

export async function runAutomationPreflight(asset: AdminAssetRecord): Promise<AutomationPreflightResult> {
  const health = await getTokenDeployStatus();
  const treasuryPolicy = validateTreasuryPolicy({ deployerAddress: health.deployerAddress });
  const hasMorpho = asset.collateralTargets.some((target) => target.protocol === 'MORPHO');
  const checks = [
    check('rpc', 'RPC', Boolean(health.chainId && !health.gasCheckError), health.gasCheckError ?? `Chain ${health.chainId}`),
    check('deployer', 'Deployer', Boolean(health.deployerAddress), health.deployerAddress ?? 'TOKEN_DEPLOY_PRIVATE_KEY no configurada.'),
    check('gas', 'Gas deployer', Boolean(health.hasGas), health.gasBalanceWei ?? 'Sin gas.'),
    check('supply', 'Supply', asset.totalTokens > 0, `${asset.totalTokens} tokens`),
    check('price', 'Precio', asset.pricePerToken > 0, `USD ${asset.pricePerToken}`),
    check('treasury', 'Treasury', treasuryPolicy.ok, treasuryPolicy.message),
    check('vault', 'Vault requerido', asset.tokenStandard !== 'ERC4626' || !asset.contractAddress || Boolean(asset.vaultAddress), asset.vaultAddress ?? 'Se desplegará automáticamente.'),
    check('morpho', 'Morpho', !hasMorpho || asset.tokenStandard === 'ERC4626', hasMorpho ? 'Morpho requiere ERC-4626.' : 'No seleccionado.')
  ];

  return {
    ok: checks.every((entry) => entry.ok),
    checks
  };
}

export async function recordAutomationPreflight(projectId: string, asset: AdminAssetRecord) {
  const result = await runAutomationPreflight(asset);
  await appendDeploymentEvent(projectId, {
    step: 'PREFLIGHT',
    status: result.ok ? 'SUCCESS' : 'FAILED',
    message: result.checks.map((entry) => `${entry.label}: ${entry.ok ? 'OK' : entry.detail}`).join(' | ')
  });
  return result;
}
