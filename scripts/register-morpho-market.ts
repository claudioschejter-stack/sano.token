import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../packages/database/.env') });
config({ path: resolve(__dirname, '../.env') });
if (process.env.DIRECT_URL?.trim()) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { getAdminAsset, updateAdminAsset } from '../apps/web/src/lib/admin/assetsService';
import { createMorphoMarketForVault } from '../apps/web/src/lib/blockchain/morphoMarketService';
import { registerProjectCollateral } from '../apps/web/src/lib/collateral/collateralOrchestrator';
import { checkMorphoLiquidity } from '../apps/web/src/lib/lending/morphoLiquidityCheck';

const projectId = process.argv[2] ?? 'proj-apart-hotel-urban-view-anelo-mplonxbv';

async function main() {
  const asset = await getAdminAsset(projectId);
  if (!asset?.vaultAddress) throw new Error('Vault not deployed');

  console.log('[morpho] creating market for vault', asset.vaultAddress);
  const created = await createMorphoMarketForVault(asset.vaultAddress, asset.pricePerToken);
  console.log('[morpho] create result', created);

  if (created.status === 'CREATED') {
    await updateAdminAsset(projectId, {
      collateralTargets: [
        {
          protocol: 'MORPHO',
          status: 'REGISTERED',
          readinessScore: 100,
          missingRequirements: [],
          externalId: created.marketId,
          poolUrl: `https://app.morpho.org/base/market/${created.marketId}`,
          oracleAddress: created.params.oracle,
          notes: `Mercado Morpho Blue creado (tx ${created.txHash}).`,
          submittedAt: new Date().toISOString(),
          registeredAt: new Date().toISOString(),
          lastError: null
        }
      ],
      explorerVerificationStatus: 'VERIFIED',
      tokenDeployStatus: 'DEPLOYED'
    });
  } else {
    const reg = await registerProjectCollateral(projectId, ['MORPHO']);
    console.log('[morpho] fallback register', reg?.outcomes);
  }

  const refreshed = await getAdminAsset(projectId);
  if (refreshed) {
    const liq = await checkMorphoLiquidity(refreshed);
    console.log('[morpho] liquidity', liq);
    console.log('[morpho] readyToBorrow', (await getAdminAsset(projectId))?.readyToBorrow);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
