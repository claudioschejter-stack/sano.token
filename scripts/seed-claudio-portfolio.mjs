/**
 * Seed demo portfolio for Claudio Schejter (investor account):
 * - All active marketplace projects
 * - Fiat platform balance + USDC deposit
 * - Margin debt + 30-day snapshot history
 *
 * Usage: node scripts/seed-claudio-portfolio.mjs
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../packages/database/.env') });
config({ path: resolve(__dirname, '../.env') });
if (process.env.DIRECT_URL?.trim()) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const prisma = new PrismaClient();

const INVESTOR_EMAIL = process.env.SEED_INVESTOR_EMAIL?.trim() || 'claudioschejter@hotmail.com';
const DEMO_WALLET = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
const USE_ALL_MARKETPLACE_TOKENS =
  process.argv.includes('--all-tokens') || process.env.SEED_ALL_MARKETPLACE_TOKENS === '1';

/** Token count per project for a realistic diversified book (ignored with --all-tokens) */
const TOKEN_COUNTS = {
  'proj-neuquen-corporate': 40,
  'proj-rincon-logistics': 100,
  'proj-san-patricio-industrial': 60,
  'proj-plaza-huincul-b2b': 80,
  'proj-anelo-services': 50,
  'proj-centenario-housing': 35,
  'proj-apart-hotel-urban-view-anelo-mplonxbv': 200
};

const FIAT_BALANCE_USD = 15_000;
const USDC_DEPOSIT_USD = 8_500;
const MARGIN_DEBT_USD = 35_000;

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: INVESTOR_EMAIL },
    include: { investor: true }
  });

  if (!user) {
    throw new Error(`User not found: ${INVESTOR_EMAIL}`);
  }

  const fullName = user.kycFullName?.trim() || user.name?.trim() || 'Claudio Raúl Schejter';
  const cuit = user.kycDocumentId?.trim() || `TMP-${user.id.slice(0, 8)}`;

  let investor = user.investor;

  if (!investor) {
    investor = await prisma.investor.create({
      data: {
        email: user.email,
        fullName,
        cuit,
        walletAddress: DEMO_WALLET.toLowerCase(),
        kycStatus: 'APPROVED',
        kycVerifiedAt: new Date(),
        rentPayoutPreference: 'FIAT'
      }
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        investorId: investor.id,
        walletAddress: DEMO_WALLET.toLowerCase()
      }
    });
  } else {
    await prisma.investor.update({
      where: { id: investor.id },
      data: {
        fullName,
        walletAddress: DEMO_WALLET.toLowerCase()
      }
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { walletAddress: DEMO_WALLET.toLowerCase() }
    });
  }

  await prisma.portfolio.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {}
  });

  const activeProjects = await prisma.project.findMany({
    where: { isActive: true },
    orderBy: { title: 'asc' }
  });

  if (!activeProjects.length) {
    throw new Error('No active marketplace projects found. Run prisma seed first.');
  }

  let totalCapital = 0;
  const investmentRows = [];

  for (const project of activeProjects) {
    const tokenCount = USE_ALL_MARKETPLACE_TOKENS
      ? project.totalTokens
      : (TOKEN_COUNTS[project.id] ?? 25);
    const purchasePriceUsd = Number(project.pricePerToken) * tokenCount;
    const txHash = `seed-claudio-${project.id}`;

    const investment = await prisma.investment.upsert({
      where: {
        investorId_projectId_txHash: {
          investorId: investor.id,
          projectId: project.id,
          txHash
        }
      },
      create: {
        investorId: investor.id,
        projectId: project.id,
        tokenCount,
        purchasePriceUsd,
        status: 'ACTIVE',
        txHash,
        purchasedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
      },
      update: {
        tokenCount,
        purchasePriceUsd,
        status: 'ACTIVE'
      }
    });

    totalCapital += purchasePriceUsd;
    investmentRows.push({ project: project.title, tokenCount, purchasePriceUsd });

    if (USE_ALL_MARKETPLACE_TOKENS) {
      await prisma.project.update({
        where: { id: project.id },
        data: { availableTokens: 0 }
      });
    } else if (project.availableTokens >= tokenCount) {
      await prisma.project.update({
        where: { id: project.id },
        data: { availableTokens: Math.max(0, project.availableTokens - tokenCount) }
      });
    }
  }

  await prisma.platformWalletAccount.upsert({
    where: { userId_currency: { userId: user.id, currency: 'USD' } },
    create: {
      userId: user.id,
      investorId: investor.id,
      currency: 'USD',
      balance: FIAT_BALANCE_USD,
      reserved: 0
    },
    update: {
      investorId: investor.id,
      balance: FIAT_BALANCE_USD,
      reserved: 0
    }
  });

  const existingDeposit = await prisma.platformDeposit.findFirst({
    where: {
      OR: [{ idempotencyKey: 'seed-claudio-usdc-deposit' }, { txHash: '0xseedclaudiobaseusdc001' }]
    }
  });

  if (existingDeposit) {
    await prisma.platformDeposit.update({
      where: { id: existingDeposit.id },
      data: {
        userId: user.id,
        investorId: investor.id,
        status: 'CONFIRMED',
        amountUsd: USDC_DEPOSIT_USD,
        method: 'USDC_ONCHAIN',
        stablecoinNetwork: 'BASE',
        stablecoinSymbol: 'USDC',
        payerWalletAddress: DEMO_WALLET.toLowerCase(),
        idempotencyKey: 'seed-claudio-usdc-deposit',
        confirmedAt: new Date()
      }
    });
  } else {
    await prisma.platformDeposit.create({
      data: {
        idempotencyKey: 'seed-claudio-usdc-deposit',
        userId: user.id,
        investorId: investor.id,
        status: 'CONFIRMED',
        amountUsd: USDC_DEPOSIT_USD,
        method: 'USDC_ONCHAIN',
        stablecoinNetwork: 'BASE',
        stablecoinSymbol: 'USDC',
        payerWalletAddress: DEMO_WALLET.toLowerCase(),
        txHash: '0xseedclaudiobaseusdc001',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        confirmedAt: new Date()
      }
    });
  }

  const ltv = totalCapital > 0 ? (MARGIN_DEBT_USD / totalCapital) * 100 : 0;

  await prisma.investor.update({
    where: { id: investor.id },
    data: {
      totalCapital,
      marginDebt: MARGIN_DEBT_USD,
      ltv
    }
  });

  await prisma.portfolio.updateMany({
    where: { userId: user.id },
    data: {
      totalCapital,
      activeMarginDebt: MARGIN_DEBT_USD,
      ltv
    }
  });

  const rwaValueUsd = totalCapital;
  const stablecoinUsd = USDC_DEPOSIT_USD;
  const fiatUsd = FIAT_BALANCE_USD;
  const grossAssetsUsd = rwaValueUsd + stablecoinUsd + fiatUsd;

  for (let daysAgo = 30; daysAgo >= 0; daysAgo -= 1) {
    const capturedAt = startOfUtcDay(new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000));
    const growthFactor = 0.82 + (30 - daysAgo) * 0.006;
    const snapshotGross = grossAssetsUsd * growthFactor;
    const snapshotDebt = MARGIN_DEBT_USD * (0.95 + (30 - daysAgo) * 0.0015);

    await prisma.portfolioSnapshot.upsert({
      where: {
        userId_capturedAt: {
          userId: user.id,
          capturedAt
        }
      },
      create: {
        userId: user.id,
        investorId: investor.id,
        baseCurrency: 'USD',
        totalValueUsd: snapshotGross,
        rwaValueUsd: rwaValueUsd * growthFactor,
        stablecoinUsd: stablecoinUsd * growthFactor,
        fiatUsd: fiatUsd * growthFactor,
        availableUsd: fiatUsd * growthFactor,
        debtUsd: snapshotDebt,
        ltv: snapshotGross > 0 ? (snapshotDebt / snapshotGross) * 100 : 0,
        positions: [],
        capturedAt
      },
      update: {
        totalValueUsd: snapshotGross,
        rwaValueUsd: rwaValueUsd * growthFactor,
        stablecoinUsd: stablecoinUsd * growthFactor,
        fiatUsd: fiatUsd * growthFactor,
        availableUsd: fiatUsd * growthFactor,
        debtUsd: snapshotDebt,
        ltv: snapshotGross > 0 ? (snapshotDebt / snapshotGross) * 100 : 0
      }
    });
  }

  const netLiquid = grossAssetsUsd - MARGIN_DEBT_USD;

  console.log('[seed-claudio-portfolio] Done');
  console.log(`  Mode: ${USE_ALL_MARKETPLACE_TOKENS ? 'all marketplace tokens' : 'demo allocation'}`);
  console.log(`  User: ${user.email} (${user.id})`);
  console.log(`  Investor: ${investor.id}`);
  console.log(`  Projects: ${investmentRows.length}`);
  console.log(`  RWA USD: ${rwaValueUsd.toFixed(2)}`);
  console.log(`  Stablecoin USD: ${stablecoinUsd.toFixed(2)}`);
  console.log(`  Fiat USD: ${fiatUsd.toFixed(2)}`);
  console.log(`  Debt USD: ${MARGIN_DEBT_USD.toFixed(2)}`);
  console.log(`  Net liquid value USD: ${netLiquid.toFixed(2)}`);
  console.log('  Investments:');
  for (const row of investmentRows) {
    console.log(`    - ${row.project}: ${row.tokenCount} tokens ($${row.purchasePriceUsd.toFixed(2)})`);
  }
}

main()
  .catch((error) => {
    console.error('[seed-claudio-portfolio] Failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
