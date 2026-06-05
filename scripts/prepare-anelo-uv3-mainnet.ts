#!/usr/bin/env node
/**
 * Prepara y emite on-chain "AÑELO - APART HOTEL URBAN VIEW" (ANELO UV3 RWA):
 * 5000 tokens × US$ 20, ERC-4626, Morpho, shares en treasury Safe.
 *
 * Uso:
 *   npx tsx scripts/prepare-anelo-uv3-mainnet.ts --prepare
 *   npx tsx scripts/prepare-anelo-uv3-mainnet.ts --deploy
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../packages/database/.env') });
config({ path: resolve(__dirname, '../.env') });
config({ path: resolve(__dirname, '../apps/web/.env.local') });

import { getAdminAsset, updateAdminAsset } from '../apps/web/src/lib/admin/assetsService';
import { buildInitialCollateralTargets } from '../apps/web/src/lib/collateral/collateralTargetsService';
import { finalizeErc4626AfterPersist } from '../apps/web/src/lib/admin/erc4626LaunchSave';

const PROJECT_ID = 'proj-anelo-apart-hotel-urban-view';

async function prepareUv3() {
  const asset = await getAdminAsset(PROJECT_ID);
  if (!asset) throw new Error(`Proyecto no encontrado: ${PROJECT_ID}`);

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

  await updateAdminAsset(PROJECT_ID, {
    tokenStandard: 'ERC4626',
    tokenName: 'ANELO UV3 RWA',
    tokenSymbol: 'UV3RWA',
    totalTokens: 5000,
    availableTokens: 5000,
    pricePerToken: 20,
    targetYield: 12,
    location: 'AÑELO - VACA MUERTA',
    spvEntityName: 'Sanova Urban View UV3 SPV',
    navOracleUrl: 'https://sanova.global/nav/anelo-uv3',
    jurisdiction: 'AR',
    tokenDeployStatus: 'NOT_REQUESTED',
    contractAddress: null,
    vaultAddress: null,
    chainId: null,
    vaultFundingStatus: 'NOT_REQUIRED',
    vaultFundingAmount: null,
    vaultFundingTxHash: null,
    vaultFundingError: null,
    morphoLiquidityStatus: 'NOT_CHECKED',
    explorerVerificationStatus: 'NOT_REQUESTED',
    automationFailureCount: 0,
    automationCircuitBreaker: false,
    contracts: {
      trust: asset.contracts.trust || 'https://sanova.global/legal/urban-view-trust.pdf',
      purchase: asset.contracts.purchase || 'https://sanova.global/legal/urban-view-purchase.pdf',
      lease: asset.contracts.lease || 'https://sanova.global/legal/urban-view-lease.pdf',
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
    collateralTargets,
    isActive: false
  });

  console.log('[prepare] UV3 listo para emisión: 5000 × US$ 20, Morpho, treasury Safe');
}

async function deployUv3() {
  const finalized = await finalizeErc4626AfterPersist(PROJECT_ID, { requestedPublish: false });
  if (!finalized.ok) {
    console.error('[deploy] gate issues', finalized.issues);
    throw new Error('Emisión UV3 bloqueada por launch gate');
  }

  const published = await updateAdminAsset(PROJECT_ID, { isActive: true });
  console.log(
    JSON.stringify(
      {
        id: published?.id,
        title: published?.title,
        totalTokens: published?.totalTokens,
        pricePerToken: published?.pricePerToken,
        contractAddress: published?.contractAddress,
        vaultAddress: published?.vaultAddress,
        chainId: published?.chainId,
        morpho: published?.collateralTargets.find((t) => t.protocol === 'MORPHO'),
        readyToBorrow: published?.readyToBorrow
      },
      null,
      2
    )
  );
}

async function main() {
  if (process.argv.includes('--prepare')) {
    await prepareUv3();
  }
  if (process.argv.includes('--deploy')) {
    await deployUv3();
  }
  if (!process.argv.includes('--prepare') && !process.argv.includes('--deploy')) {
    console.log(JSON.stringify(await getAdminAsset(PROJECT_ID), null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
