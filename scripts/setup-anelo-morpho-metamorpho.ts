import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../packages/database/.env') });
config({ path: resolve(__dirname, '../.env') });
if (process.env.DIRECT_URL?.trim()) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { getAdminAsset, updateAdminAsset } from '../apps/web/src/lib/admin/assetsService';
import { createMorphoMarketForVault } from '../apps/web/src/lib/blockchain/morphoMarketService';
import {
  deployMetaMorphoVault,
  setupMetaMorphoForMarket,
  buildMetaMorphoDisclosure
} from '../apps/web/src/lib/lending/metaMorphoService';
import { buildDefaultMorphoMarketParams } from '../apps/web/src/lib/lending/protocols/morphoBorrow';
import { checkMorphoLiquidity } from '../apps/web/src/lib/lending/morphoLiquidityCheck';

const projectId = process.argv[2] ?? 'proj-apart-hotel-urban-view-anelo-mplonxbv';
const mode = process.argv.includes('--deploy-metamorpho') ? 'deploy-metamorpho' : 'setup';

async function main() {
  const asset = await getAdminAsset(projectId);
  if (!asset?.vaultAddress) {
    throw new Error(`Vault no desplegado para ${projectId}`);
  }

  console.log('[anelo-morpho] Proyecto:', asset.title);
  console.log('[anelo-morpho] Vault RWA:', asset.vaultAddress);
  console.log('[anelo-morpho] Oracle type:', process.env.MORPHO_ORACLE_TYPE ?? 'nav');

  if (mode === 'deploy-metamorpho' && !process.env.METAMORPHO_VAULT_ADDRESS?.trim()) {
    const deployed = await deployMetaMorphoVault({
      name: 'Sanova Añelo RWA USDC Vault',
      symbol: 'srAñeloUSDC'
    });
    console.log('[metamorpho] deploy', deployed);
    if (deployed.status === 'DEPLOYED') {
      console.log(`\nConfigurá METAMORPHO_VAULT_ADDRESS=${deployed.vaultAddress}\n`);
    }
    return;
  }

  console.log('[morpho] Creando mercado aislado (USDC loan / vault collateral)...');
  const created = await createMorphoMarketForVault(asset.vaultAddress, asset.pricePerToken);
  console.log('[morpho] result', created);

  if (created.status === 'CREATED') {
    const morphoTarget = {
      protocol: 'MORPHO' as const,
      status: 'REGISTERED' as const,
      readinessScore: 100,
      missingRequirements: [] as string[],
      externalId: created.marketId,
      poolUrl: `https://app.morpho.org/base/market/${created.marketId}`,
      oracleAddress: created.params.oracle,
      notes: [
        `Mercado Morpho Blue aislado (${created.oracleType ?? 'nav'} oracle).`,
        created.metaMorphoPoolUrl ? `MetaMorpho: ${created.metaMorphoPoolUrl}` : null
      ]
        .filter(Boolean)
        .join(' '),
      submittedAt: new Date().toISOString(),
      registeredAt: new Date().toISOString(),
      lastError: null
    };

    await updateAdminAsset(projectId, {
      navOracleUrl: asset.navOracleUrl ?? 'https://sanova.global/nav/urban-view-anelo',
      collateralTargets: [morphoTarget],
      explorerVerificationStatus: 'VERIFIED',
      tokenDeployStatus: 'DEPLOYED'
    });

    if (process.env.METAMORPHO_VAULT_ADDRESS?.trim() && created.status === 'CREATED') {
      const meta = await setupMetaMorphoForMarket(created.params);
      console.log('[metamorpho] setup', meta);

      if (meta.status === 'READY') {
        const disclosure = buildMetaMorphoDisclosure({
          projectTitle: asset.title,
          vaultAddress: meta.vaultAddress,
          rwaVaultAddress: asset.vaultAddress,
          oracleAddress: created.params.oracle,
          navOracleUrl: asset.navOracleUrl,
          marketId: created.marketId,
          pricePerTokenUsd: asset.pricePerToken,
          totalTokens: asset.totalTokens
        });
        console.log('[metamorpho] institutional disclosure', JSON.stringify(disclosure, null, 2));
      }
    }
  }

  const refreshed = await getAdminAsset(projectId);
  if (refreshed) {
    const liq = await checkMorphoLiquidity(refreshed);
    console.log('[morpho] liquidity', liq);
    console.log('[morpho] NAV público:', refreshed.navOracleUrl ?? `https://sanova.global/nav/urban-view-anelo`);
    console.log('[morpho] readyToBorrow', refreshed.readyToBorrow);
  }

  const params = buildDefaultMorphoMarketParams(asset.vaultAddress, created.status === 'CREATED' ? created.params.oracle : undefined);
  console.log('[morpho] market params', params);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
