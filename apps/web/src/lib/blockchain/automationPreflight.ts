import type { AdminAssetRecord } from '../admin/assetsService';
import { appendDeploymentEvent } from '../admin/assetsService';
import { getTokenDeployStatus } from './tokenDeployConfig';
import { validateTreasuryPolicy } from './treasuryPolicy';
import { evaluateCollateralReadiness } from '../collateral/collateralRegistry';
import { validateOraclePricing } from './pricingOracleValidation';
import { enqueueAutomationJob } from '../admin/automationJobs';

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
  const treasuryPolicy = await validateTreasuryPolicy({ deployerAddress: health.deployerAddress });
  const hasMorpho = asset.collateralTargets.some((target) => target.protocol === 'MORPHO');
  const morphoReadiness = hasMorpho ? evaluateCollateralReadiness(asset, 'MORPHO') : null;
  const legalReady =
    !hasMorpho ||
    Boolean(asset.contracts.trust) &&
      asset.centrifugeChecklist.legalAuditDone &&
      asset.centrifugeChecklist.kycPolicyActive &&
      asset.centrifugeChecklist.liquidityPlanDocumented;
  const pricing = await validateOraclePricing(asset);
  const checks = [
    check('rpc', 'RPC', Boolean(health.chainId && !health.gasCheckError), health.gasCheckError ?? `Chain ${health.chainId}`),
    check('deployer', 'Deployer', Boolean(health.deployerAddress), health.deployerAddress ?? 'TOKEN_DEPLOY_PRIVATE_KEY no configurada.'),
    check('gas', 'Gas deployer', Boolean(health.hasGas), health.gasBalanceWei ?? 'Sin gas.'),
    check('supply', 'Supply', asset.totalTokens > 0, `${asset.totalTokens} tokens`),
    check('price', 'Precio', asset.pricePerToken > 0, `USD ${asset.pricePerToken}`),
    check('treasury', 'Treasury', treasuryPolicy.ok, treasuryPolicy.message),
    check(
      'legal',
      'Legal bloqueante',
      legalReady,
      morphoReadiness?.missing.length ? `Faltan: ${morphoReadiness.missing.join(', ')}` : 'Checklist legal completo.'
    ),
    check('pricingOracle', 'Pricing/oracle', pricing.ok, pricing.message),
    check('vault', 'Vault requerido', asset.tokenStandard !== 'ERC4626' || !asset.contractAddress || Boolean(asset.vaultAddress), asset.vaultAddress ?? 'Se desplegará automáticamente.'),
    check('morpho', 'Morpho', !hasMorpho || asset.tokenStandard === 'ERC4626', hasMorpho ? 'Morpho requiere ERC-4626.' : 'No seleccionado.')
  ];

  return {
    ok: checks.every((entry) => entry.ok),
    checks
  };
}

export async function recordAutomationPreflight(
  projectId: string,
  asset: AdminAssetRecord,
  options: { persistJob?: boolean } = {}
) {
  const result = await runAutomationPreflight(asset);
  const plannedJobs = [
    !asset.contractAddress ? 'TOKEN_DEPLOY' : null,
    asset.tokenStandard === 'ERC4626' && !asset.vaultAddress ? 'VAULT_DEPLOY' : null,
    asset.collateralTargets.length ? 'COLLATERAL_REGISTER' : null,
    asset.collateralTargets.some((target) => target.protocol === 'MORPHO') ? 'MORPHO_LIQUIDITY' : null,
    'EXPLORER_VERIFY'
  ].filter(Boolean);
  await appendDeploymentEvent(projectId, {
    step: 'PREFLIGHT',
    status: result.ok ? 'SUCCESS' : 'FAILED',
    message: [
      ...result.checks.map((entry) => `${entry.label}: ${entry.ok ? 'OK' : entry.detail}`),
      `Jobs: ${plannedJobs.join(', ') || 'ninguno'}`,
      `Ready-to-borrow actual: ${asset.readyToBorrow ? 'sí' : 'no'}`
    ].join(' | ')
  });
  await appendDeploymentEvent(projectId, {
    step: 'PRICING_ORACLE',
    status: result.checks.find((entry) => entry.key === 'pricingOracle')?.ok ? 'SUCCESS' : 'FAILED',
    message: result.checks.find((entry) => entry.key === 'pricingOracle')?.detail ?? 'Pricing no evaluado.'
  });
  if (options.persistJob ?? true) {
    await enqueueAutomationJob({
      projectId,
      step: 'PREFLIGHT',
      payload: {
        checks: result.checks,
        plannedJobs,
        contracts: {
          token: asset.contractAddress,
          vault: asset.vaultAddress
        },
        treasury: process.env.TOKEN_TREASURY_ADDRESS ?? process.env.SANOVA_TREASURY_ADDRESS ?? null,
        morpho: asset.collateralTargets.find((target) => target.protocol === 'MORPHO') ?? null,
        liquidity: asset.morphoLiquidityStatus,
        legal: result.checks.find((entry) => entry.key === 'legal') ?? null,
        readyToBorrow: asset.readyToBorrow
      }
    }).catch(() => undefined);
  }
  return result;
}
