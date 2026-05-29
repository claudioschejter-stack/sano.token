import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../packages/database/.env') });
config({ path: resolve(__dirname, '../.env') });
if (process.env.DIRECT_URL?.trim()) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { getAdminAsset, updateAdminAsset } from '../apps/web/src/lib/admin/assetsService';
import { registerProjectCollateral } from '../apps/web/src/lib/collateral/collateralOrchestrator';
import { checkMorphoLiquidity } from '../apps/web/src/lib/lending/morphoLiquidityCheck';

const PROJECT_ID = process.argv[2] ?? 'proj-apart-hotel-urban-view-anelo-mplonxbv';
const MARKET_ID = '0x81e928e6f75f1c5a7f59a1b3f9d96e856b537fbecb53914e156df346b8f1a00d';
const ORACLE = '0x5640A966F960A3Cb22681a186f39337E0355d86B';

async function main() {
  await updateAdminAsset(PROJECT_ID, {
    tokenDeployStatus: 'DEPLOYED',
    explorerVerificationStatus: 'VERIFIED',
    collateralTargets: [
      {
        protocol: 'MORPHO',
        status: 'REGISTERED',
        readinessScore: 100,
        missingRequirements: [],
        externalId: MARKET_ID,
        poolUrl: `https://app.morpho.org/base/market/${MARKET_ID}`,
        oracleAddress: ORACLE,
        notes: 'Mercado Morpho Blue confirmado on-chain (Base mainnet).',
        submittedAt: new Date().toISOString(),
        registeredAt: new Date().toISOString(),
        lastError: null
      }
    ]
  });

  const reg = await registerProjectCollateral(PROJECT_ID, ['MORPHO']);
  console.log('[finalize] morpho', reg?.outcomes?.[0]?.target?.status, reg?.outcomes?.[0]?.target?.oracleAddress);

  let asset = await getAdminAsset(PROJECT_ID);
  if (asset) {
    const liq = await checkMorphoLiquidity(asset);
    console.log('[finalize] liquidity', liq);
    asset = await getAdminAsset(PROJECT_ID);
    console.log('[finalize] readyToBorrow', asset?.readyToBorrow);
    console.log('[finalize] automationReadiness', asset?.automationReadiness?.status);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
