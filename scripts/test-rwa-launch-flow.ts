import 'dotenv/config';
import { createAdminAsset, getAdminAsset } from '../apps/web/src/lib/admin/assetsService';
import { executeProjectAutomationRepair } from '../apps/web/src/lib/blockchain/projectTokenDeploy';

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

async function resolveProjectId(): Promise<string> {
  const projectId = readArg('--project-id');
  if (projectId) {
    return projectId;
  }

  if (!process.argv.includes('--create-demo')) {
    throw new Error('Usá --project-id <id> o --create-demo para crear un asset de prueba.');
  }

  const suffix = Date.now().toString(36);
  const asset = await createAdminAsset({
    title: `Sanova RWA Test ${suffix}`,
    description: 'Asset dummy para testear emisión ERC-4626, vault, fondeo y Morpho.',
    location: 'Buenos Aires, Argentina',
    totalTokens: 10,
    pricePerToken: 50,
    targetYield: 8,
    tokenName: `SANOVA TEST ${suffix}`,
    tokenSymbol: `T${suffix.slice(-4)}`,
    tokenStandard: 'ERC4626',
    tokenInstrumentType: 'EQUITY',
    jurisdiction: 'AR',
    collateralProtocols: ['MORPHO'],
    deployToken: false
  });

  return asset.id;
}

async function main() {
  const projectId = await resolveProjectId();
  console.log(`[rwa-flow] Testing project ${projectId}`);

  const result = await executeProjectAutomationRepair(projectId);
  const asset = result.asset ?? (await getAdminAsset(projectId));

  if (!asset) {
    throw new Error('Asset not found after repair.');
  }

  const morpho = asset.collateralTargets.find((target) => target.protocol === 'MORPHO');
  const checks = {
    token: Boolean(asset.contractAddress),
    vault: Boolean(asset.vaultAddress),
    vaultFunded: asset.vaultFundingStatus === 'FUNDED',
    morphoRegistered: morpho?.status === 'REGISTERED',
    oracle: Boolean(morpho?.oracleAddress)
  };

  console.log(JSON.stringify({ projectId, checks, asset, morpho }, null, 2));

  const failed = Object.entries(checks).filter(([, ok]) => !ok);
  if (failed.length) {
    throw new Error(`RWA flow incomplete: ${failed.map(([key]) => key).join(', ')}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
