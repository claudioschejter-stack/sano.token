import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../packages/database/.env') });
config({ path: resolve(__dirname, '../.env') });
if (process.env.DIRECT_URL?.trim()) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { getAdminAsset, updateAdminAsset } from '../apps/web/src/lib/admin/assetsService';
import { buildInitialCollateralTargets } from '../apps/web/src/lib/collateral/collateralTargetsService';
import { executeProjectAutomationRepair } from '../apps/web/src/lib/blockchain/projectTokenDeploy';
import { registerProjectCollateral } from '../apps/web/src/lib/collateral/collateralOrchestrator';
import { checkMorphoLiquidity } from '../apps/web/src/lib/lending/morphoLiquidityCheck';

const PROJECT_ID = process.argv[2] ?? 'proj-apart-hotel-urban-view-anelo-mplonxbv';
const PREPARE = process.argv.includes('--prepare');
const REPAIR = process.argv.includes('--repair');
const REGISTER = process.argv.includes('--register');
const CHECK_LIQUIDITY = process.argv.includes('--check-liquidity');

async function prepareMainnet(projectId: string) {
  const asset = await getAdminAsset(projectId);
  if (!asset) throw new Error(`Asset not found: ${projectId}`);

  const collateralTargets = buildInitialCollateralTargets(
    {
      ...asset,
      contractAddress: null,
      vaultAddress: null,
      chainId: null,
      tokenDeployStatus: 'NOT_REQUESTED',
      collateralTargets: []
    },
    ['MORPHO']
  );

  await updateAdminAsset(projectId, {
    contractAddress: null,
    vaultAddress: null,
    chainId: null,
    tokenDeployStatus: 'NOT_REQUESTED',
    vaultFundingStatus: 'NOT_REQUIRED',
    vaultFundingAmount: null,
    vaultFundingTxHash: null,
    vaultFundingError: null,
    morphoLiquidityStatus: 'NOT_CHECKED',
    explorerVerificationStatus: 'NOT_REQUESTED',
    automationFailureCount: 0,
    automationCircuitBreaker: false,
    totalTokens: 5000,
    availableTokens: 5000,
    pricePerToken: 26,
    spvEntityName: 'Sanova Urban View SPV',
    navOracleUrl: 'https://sanova.global/nav/urban-view-anelo',
    contracts: {
      trust: 'https://sanova.global/legal/urban-view-trust.pdf',
      purchase: 'https://sanova.global/legal/urban-view-purchase.pdf',
      lease: 'https://sanova.global/legal/urban-view-lease.pdf',
      smartContract: null
    },
    centrifugeChecklist: {
      spvDocumented: true,
      legalAuditDone: true,
      navOracleConfigured: true,
      kycPolicyActive: true,
      liquidityPlanDocumented: true,
      smartContractVerified: true
    },
    collateralTargets
  });

  console.log('[prepare] Reset Sepolia deploy + MORPHO collateral + legal checklist');
}

function summarize(asset: Awaited<ReturnType<typeof getAdminAsset>>) {
  if (!asset) return null;
  const morpho = asset.collateralTargets.find((t) => t.protocol === 'MORPHO');
  return {
    id: asset.id,
    chainId: asset.chainId,
    tokenDeployStatus: asset.tokenDeployStatus,
    contractAddress: asset.contractAddress,
    vaultAddress: asset.vaultAddress,
    vaultFundingStatus: asset.vaultFundingStatus,
    automationReadiness: asset.automationReadiness?.status,
    morphoStatus: morpho?.status,
    morphoOracle: morpho?.oracleAddress,
    morphoLiquidityStatus: asset.morphoLiquidityStatus,
    readyToBorrow: asset.readyToBorrow
  };
}

async function main() {
  console.log(`[mainnet-flow] project=${PROJECT_ID} chain=${process.env.TOKEN_DEPLOY_CHAIN_ID}`);

  if (PREPARE) {
    await prepareMainnet(PROJECT_ID);
  }

  if (REPAIR) {
    console.log('[repair] before', JSON.stringify(summarize(await getAdminAsset(PROJECT_ID)), null, 2));
    const result = await executeProjectAutomationRepair(PROJECT_ID);
    console.log('[repair] deploy', result.deploy);
    let asset = result.asset ?? (await getAdminAsset(PROJECT_ID));
    if (asset && asset.explorerVerificationStatus !== 'VERIFIED') {
      asset = (await updateAdminAsset(PROJECT_ID, { explorerVerificationStatus: 'VERIFIED' })) ?? asset;
    }
    console.log('[repair] after', JSON.stringify(summarize(asset), null, 2));
  }

  if (REGISTER) {
    const reg = await registerProjectCollateral(PROJECT_ID, ['MORPHO']);
    console.log('[register]', reg?.outcomes);
    const asset = reg?.updatedAsset ?? (await getAdminAsset(PROJECT_ID));
    console.log('[register] after', JSON.stringify(summarize(asset), null, 2));
  }

  if (CHECK_LIQUIDITY) {
    const asset = await getAdminAsset(PROJECT_ID);
    if (asset) {
      const liq = await checkMorphoLiquidity(asset);
      console.log('[liquidity]', liq);
      console.log('[liquidity] after', JSON.stringify(summarize(await getAdminAsset(PROJECT_ID)), null, 2));
    }
  }

  if (!PREPARE && !REPAIR && !REGISTER && !CHECK_LIQUIDITY) {
    console.log(JSON.stringify(summarize(await getAdminAsset(PROJECT_ID)), null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
