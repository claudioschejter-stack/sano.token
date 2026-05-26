import { createAdminAsset, getAdminAsset } from './assetsService';
import { notifyAutomationIssue } from './automationAlerts';
import { executeProjectAutomationRepair } from '../blockchain/projectTokenDeploy';

export async function runSyntheticRwaFlow(input: { projectId?: string; createDemo?: boolean } = {}) {
  let projectId = input.projectId;

  if (!projectId && input.createDemo) {
    const suffix = Date.now().toString(36);
    const asset = await createAdminAsset({
      title: `Sanova RWA Synthetic ${suffix}`,
      description: 'Synthetic diario para validar emisión ERC-4626, vault, Morpho, liquidez y borrow-readiness.',
      location: 'Buenos Aires, Argentina',
      totalTokens: 5000,
      pricePerToken: 50,
      targetYield: 8,
      tokenName: `SANOVA SYNTH ${suffix}`,
      tokenSymbol: `S${suffix.slice(-5)}`,
      tokenStandard: 'ERC4626',
      tokenInstrumentType: 'EQUITY',
      jurisdiction: 'AR',
      spvEntityName: 'Sanova Synthetic SPV',
      navOracleUrl: 'https://sanova.synthetic/nav',
      contracts: {
        trust: 'https://sanova.synthetic/trust.pdf',
        purchase: 'https://sanova.synthetic/purchase.pdf',
        lease: 'https://sanova.synthetic/lease.pdf'
      },
      centrifugeChecklist: {
        spvDocumented: true,
        legalAuditDone: true,
        navOracleConfigured: true,
        kycPolicyActive: true,
        liquidityPlanDocumented: true,
        smartContractVerified: false
      },
      collateralProtocols: ['MORPHO'],
      deployToken: false,
      isActive: false
    });
    projectId = asset.id;
  }

  if (!projectId) {
    throw new Error('Synthetic RWA flow requires projectId or createDemo.');
  }

  const result = await executeProjectAutomationRepair(projectId);
  const asset = result.asset ?? (await getAdminAsset(projectId));
  if (!asset) {
    throw new Error('Asset not found after synthetic repair.');
  }

  const morpho = asset.collateralTargets.find((target) => target.protocol === 'MORPHO');
  const checks = {
    token: Boolean(asset.contractAddress),
    vault: Boolean(asset.vaultAddress),
    vaultFunded: asset.vaultFundingStatus === 'FUNDED',
    ownership: asset.deploymentEvents.some(
      (event) => event.step === 'OWNERSHIP_TRANSFER' && event.status === 'SUCCESS'
    ),
    morphoRegistered: morpho?.status === 'REGISTERED',
    oracle: Boolean(morpho?.oracleAddress),
    liquidity: asset.morphoLiquidityStatus === 'LIQUID',
    readyToBorrow: asset.readyToBorrow
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok);
  if (failed.length) {
    const message = `Synthetic RWA flow incomplete: ${failed.map(([key]) => key).join(', ')}`;
    await notifyAutomationIssue({
      projectId,
      title: asset.title,
      message,
      severity: 'critical'
    });
    throw new Error(message);
  }

  return { projectId, checks };
}
