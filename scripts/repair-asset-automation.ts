import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../packages/database/.env') });
config({ path: resolve(__dirname, '../.env') });

// Prefer direct Postgres when pooler is unreachable locally.
if (process.env.DIRECT_URL?.trim()) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { listAdminAssets, getAdminAsset } from '../apps/web/src/lib/admin/assetsService';
import { executeProjectAutomationRepair } from '../apps/web/src/lib/blockchain/projectTokenDeploy';

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function summarizeAsset(asset: Awaited<ReturnType<typeof getAdminAsset>>) {
  if (!asset) return null;
  const morpho = asset.collateralTargets.find((t) => t.protocol === 'MORPHO');
  return {
    id: asset.id,
    title: asset.title,
    tokenStandard: asset.tokenStandard,
    chainId: asset.chainId,
    tokenDeployStatus: asset.tokenDeployStatus,
    contractAddress: asset.contractAddress,
    vaultAddress: asset.vaultAddress,
    vaultFundingStatus: asset.vaultFundingStatus,
    automationReadiness: asset.automationReadiness?.status ?? null,
    morphoStatus: morpho?.status ?? null,
    morphoOracle: morpho?.oracleAddress ?? null,
    morphoLiquidityStatus: asset.morphoLiquidityStatus,
    readyToBorrow: asset.readyToBorrow,
    automationCircuitBreaker: asset.automationCircuitBreaker
  };
}

async function main() {
  const projectId = readArg('--project-id');
  const auditOnly = process.argv.includes('--audit');

  if (auditOnly || !projectId) {
    const assets = await listAdminAssets('ALL');
    const erc4626 = assets.filter((a) => a.tokenStandard === 'ERC4626');
    console.log(`[audit] ${erc4626.length} ERC-4626 assets`);
    for (const asset of erc4626) {
      console.log(JSON.stringify(summarizeAsset(asset), null, 2));
    }
    if (!projectId) return;
  }

  console.log(`[repair] Starting automation repair for ${projectId}`);
  const before = await getAdminAsset(projectId);
  console.log('[repair] Before:', JSON.stringify(summarizeAsset(before), null, 2));

  const result = await executeProjectAutomationRepair(projectId);
  const after = result.asset ?? (await getAdminAsset(projectId));
  console.log('[repair] Deploy:', result.deploy);
  console.log('[repair] Collateral:', result.collateral ? 'executed' : 'skipped');
  console.log('[repair] After:', JSON.stringify(summarizeAsset(after), null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
