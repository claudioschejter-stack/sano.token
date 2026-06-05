#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: resolve(root, 'packages/database/.env') });
config({ path: resolve(root, '.env') });
config({ path: resolve(root, 'apps/web/.env.local') });

import { getAdminAsset } from '../apps/web/src/lib/admin/assetsService';
import { runAutomationPreflight } from '../apps/web/src/lib/blockchain/automationPreflight';
import { mergeLaunchGateIssues, getErc4626OnChainIssues } from '../apps/web/src/lib/admin/erc4626LaunchGate';
import { validateErc4626MorphoFormRequirements } from '../apps/web/src/lib/admin/erc4626MorphoGate';

const PROJECT_ID = 'proj-anelo-apart-hotel-urban-view';

async function main() {
const asset = await getAdminAsset(PROJECT_ID);
if (!asset) {
  throw new Error('asset missing');
}

const preflight = await runAutomationPreflight(asset);
const morphoIssues = validateErc4626MorphoFormRequirements(
  {
    totalTokens: asset.totalTokens,
    spvEntityName: asset.spvEntityName,
    navOracleUrl: asset.navOracleUrl,
    jurisdiction: asset.jurisdiction,
    contracts: asset.contracts,
    centrifugeChecklist: asset.centrifugeChecklist,
    collateralMorpho: true
  },
  asset
);

console.log('=== Asset snapshot ===');
console.log(
  JSON.stringify(
    {
      tokenDeployStatus: asset.tokenDeployStatus,
      contractAddress: asset.contractAddress,
      vaultAddress: asset.vaultAddress,
      vaultFundingStatus: asset.vaultFundingStatus,
      smartContract: asset.contracts.smartContract,
      automationFailureCount: asset.automationFailureCount,
      automationCircuitBreaker: asset.automationCircuitBreaker,
      mediaCount: asset.mediaGallery.length,
      collateralTargets: asset.collateralTargets
    },
    null,
    2
  )
);

console.log('\n=== Preflight ===');
console.log(JSON.stringify(preflight, null, 2));

console.log('\n=== Morpho form issues ===');
console.log(JSON.stringify(morphoIssues, null, 2));

console.log('\n=== On-chain issues ===');
console.log(JSON.stringify(getErc4626OnChainIssues(asset), null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
