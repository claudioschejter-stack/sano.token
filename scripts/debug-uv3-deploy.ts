#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../packages/database/.env') });
config({ path: resolve(__dirname, '../.env') });

import { clearAutomationFailures, getAdminAsset, updateAdminAsset } from '../apps/web/src/lib/admin/assetsService';
import { deployLaunchToken } from '../apps/web/src/lib/blockchain/deployLaunchToken';

const PROJECT_ID = 'proj-anelo-apart-hotel-urban-view';

async function main() {
  await clearAutomationFailures(PROJECT_ID);
  await updateAdminAsset(PROJECT_ID, {
    tokenDeployStatus: 'NOT_REQUESTED',
    contractAddress: null,
    vaultAddress: null,
    vaultFundingStatus: 'NOT_REQUIRED'
  });

  const asset = await getAdminAsset(PROJECT_ID);
  if (!asset) throw new Error('asset missing');

  console.log('[debug] deploying', {
    title: asset.title,
    totalTokens: asset.totalTokens,
    symbol: asset.tokenSymbol,
    name: asset.tokenName
  });

  const result = await deployLaunchToken({
    tokenStandard: 'ERC4626',
    tokenInstrumentType: asset.tokenInstrumentType,
    tokenName: asset.tokenName ?? asset.title,
    tokenSymbol: asset.tokenSymbol ?? 'UV3RWA',
    totalSupplyUnits: asset.totalTokens
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
