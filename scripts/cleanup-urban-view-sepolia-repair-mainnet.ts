#!/usr/bin/env node
/**
 * Remove Sepolia Urban View duplicates and restore mainnet borrow readiness.
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../packages/database/.env') });
config({ path: resolve(__dirname, '../.env') });
if (process.env.DIRECT_URL?.trim()) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import {
  clearAutomationFailures,
  deleteAdminAsset,
  getAdminAsset,
  updateAdminAsset
} from '../apps/web/src/lib/admin/assetsService';
import { checkMorphoLiquidity } from '../apps/web/src/lib/lending/morphoLiquidityCheck';
import { PrismaClient } from '@prisma/client';

const SEPOLIA_IDS = ['proj-apart-hotel-urban-view-anelo', 'proj-apart-hotel-urban-view'];
const MAINNET_ID = 'proj-apart-hotel-urban-view-anelo-mplonxbv';
const MARKET_ID = '0x81e928e6f75f1c5a7f59a1b3f9d96e856b537fbecb53914e156df346b8f1a00d';
const ORACLE = '0x5640A966F960A3Cb22681a186f39337E0355d86B';

const prisma = new PrismaClient();

async function removeSepoliaDuplicates() {
  console.log('=== Remove Sepolia Urban View duplicates ===\n');

  for (const projectId of SEPOLIA_IDS) {
    const before = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        isActive: true,
        _count: { select: { investments: { where: { status: 'ACTIVE' } } } }
      }
    });

    if (!before) {
      console.log(`skip ${projectId} (not found)`);
      continue;
    }

    if (before.isActive) {
      await prisma.project.update({
        where: { id: projectId },
        data: { isActive: false }
      });
      console.log(`unpublished ${projectId}`);
    }

    const result = await deleteAdminAsset(projectId);
    if (result.ok) {
      console.log(`deleted ${projectId} (${before.title})`);
    } else {
      console.log(`delete failed ${projectId}:`, result.code);
    }
  }
}

async function repairMainnetBorrowReady() {
  console.log('\n=== Repair mainnet Urban View borrow readiness ===\n');

  await clearAutomationFailures(MAINNET_ID);

  await updateAdminAsset(MAINNET_ID, {
    tokenDeployStatus: 'DEPLOYED',
    vaultFundingStatus: 'FUNDED',
    explorerVerificationStatus: 'VERIFIED',
    morphoLiquidityStatus: 'LIQUID',
    automationFailureCount: 0,
    automationCircuitBreaker: false,
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

  let asset = await getAdminAsset(MAINNET_ID);
  if (asset) {
    await checkMorphoLiquidity(asset);
    asset = await getAdminAsset(MAINNET_ID);
  }

  console.log(
    JSON.stringify(
      {
        id: asset?.id,
        title: asset?.title,
        automationReadiness: asset?.automationReadiness?.status,
        automationCircuitBreaker: asset?.automationCircuitBreaker,
        morphoLiquidityStatus: asset?.morphoLiquidityStatus,
        readyToBorrow: asset?.readyToBorrow
      },
      null,
      2
    )
  );

  if (!asset?.readyToBorrow) {
    throw new Error('Mainnet asset is still not readyToBorrow after repair');
  }
}

async function main() {
  await removeSepoliaDuplicates();
  await repairMainnetBorrowReady();
  console.log('\nDone.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
