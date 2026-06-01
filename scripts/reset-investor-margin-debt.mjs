/**
 * Reset legacy DB margin debt for an investor (production cleanup).
 *
 * Usage:
 *   node scripts/reset-investor-margin-debt.mjs
 *   node scripts/reset-investor-margin-debt.mjs --env .env.vercel.production
 *   node scripts/reset-investor-margin-debt.mjs --email claudioschejter@hotmail.com
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));

const envArgIndex = process.argv.indexOf('--env');
const envFile =
  envArgIndex >= 0 ? process.argv[envArgIndex + 1] : process.env.RESET_DEBT_ENV ?? '.env';

config({ path: resolve(__dirname, '../packages/database/.env') });
config({ path: resolve(__dirname, `../${envFile}`) });
config({ path: resolve(__dirname, '../.env') });

if (process.env.DIRECT_URL?.trim()) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const emailArgIndex = process.argv.indexOf('--email');
const INVESTOR_EMAIL =
  (emailArgIndex >= 0 ? process.argv[emailArgIndex + 1] : null)?.trim() ||
  process.env.SEED_INVESTOR_EMAIL?.trim() ||
  'claudioschejter@hotmail.com';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: INVESTOR_EMAIL },
    select: {
      id: true,
      email: true,
      investorId: true,
      investor: {
        select: {
          id: true,
          marginDebt: true,
          ltv: true
        }
      }
    }
  });

  if (!user?.investor) {
    throw new Error(`Investor not found for ${INVESTOR_EMAIL}`);
  }

  const previousDebt = user.investor.marginDebt.toString();
  const previousLtv = user.investor.ltv.toString();

  await prisma.$transaction([
    prisma.investor.update({
      where: { id: user.investor.id },
      data: {
        marginDebt: 0,
        ltv: 0
      }
    }),
    prisma.portfolio.updateMany({
      where: { userId: user.id },
      data: { activeMarginDebt: 0, ltv: 0 }
    }),
    prisma.portfolioSnapshot.updateMany({
      where: { userId: user.id },
      data: { debtUsd: 0, ltv: 0 }
    })
  ]);

  console.log(`Reset margin debt for ${INVESTOR_EMAIL}`);
  console.log(`  marginDebt: ${previousDebt} -> 0`);
  console.log(`  ltv: ${previousLtv} -> 0`);
  console.log(`  portfolio snapshots debtUsd cleared for user ${user.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
