#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function mergeEnv(...files: string[]) {
  const merged: Record<string, string> = {};
  for (const file of files) {
    if (!require('node:fs').existsSync(file)) continue;
    for (const rawLine of require('node:fs').readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (value.trim()) merged[key] = value;
    }
  }
  return merged;
}

const env = mergeEnv(
  resolve(ROOT, '.env'),
  resolve(ROOT, '.env.local'),
  resolve(ROOT, 'apps/web/.env.vercel.prod.current'),
  resolve(ROOT, 'packages/database/.env')
);
for (const [key, value] of Object.entries(env)) {
  process.env[key] = value;
}

// Prisma: usar pooler (DATABASE_URL). DIRECT_URL solo para migraciones manuales.

const PRODUCTION_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://sano-token-web.vercel.app';

async function checkProductionEndpoint() {
  const url = `${PRODUCTION_URL}/api/admin/token-deploy/status`;
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(body);
  } catch {
    json = body.slice(0, 200);
  }

  return {
    url,
    status: response.status,
    ok: response.ok,
    body: json
  };
}

async function checkLocalDeployHealth() {
  const { getTokenDeployStatus } = await import('../apps/web/src/lib/blockchain/tokenDeployConfig');
  const { resolveTreasuryAddress } = await import('../apps/web/src/lib/blockchain/treasuryPolicy');
  const { readTreasuryVaultReadiness } = await import('../apps/web/src/lib/blockchain/verifyTreasuryVaultShares');
  const { getAdminAsset } = await import('../apps/web/src/lib/admin/assetsService');

  const deploy = await getTokenDeployStatus();
  const treasury = resolveTreasuryAddress();

  const uv2 = await getAdminAsset('proj-apart-hotel-urban-view-anelo-mplonxbv');
  const uv3 = await getAdminAsset('proj-anelo-apart-hotel-urban-view');

  let uv2Treasury = null;
  if (uv2?.vaultAddress) {
    uv2Treasury = await readTreasuryVaultReadiness(uv2);
  }

  return {
    deploy,
    treasury,
    automationDisabled: process.env.AUTOMATION_DISABLED ?? null,
    morphoSeed: process.env.MORPHO_SEED_LIQUIDITY_USDC ?? null,
    chainId: process.env.TOKEN_DEPLOY_CHAIN_ID ?? null,
    uv2: uv2
      ? {
          id: uv2.id,
          title: uv2.title,
          contractAddress: uv2.contractAddress,
          vaultAddress: uv2.vaultAddress,
          tokenDeployStatus: uv2.tokenDeployStatus,
          vaultFundingStatus: uv2.vaultFundingStatus,
          treasuryReadiness: uv2Treasury
        }
      : null,
    uv3: uv3
      ? {
          id: uv3.id,
          title: uv3.title,
          totalTokens: uv3.totalTokens,
          pricePerToken: uv3.pricePerToken,
          tokenDeployStatus: uv3.tokenDeployStatus,
          contractAddress: uv3.contractAddress,
          isActive: uv3.isActive
        }
      : null
  };
}

async function main() {
  console.log('=== Production endpoint (requiere sesión admin) ===');
  const endpoint = await checkProductionEndpoint();
  console.log(JSON.stringify(endpoint, null, 2));

  console.log('\n=== Health local con env de producción ===');
  const health = await checkLocalDeployHealth();
  console.log(JSON.stringify(health, null, 2));

  const ready =
    health.deploy.configured &&
    health.deploy.hasGas &&
    Boolean(health.treasury) &&
    health.automationDisabled === 'false';

  console.log(`\n=== Emisión lista: ${ready ? 'SÍ' : 'NO'} ===`);
  if (!ready) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
