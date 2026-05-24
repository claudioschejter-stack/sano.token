/**
 * Deletes all users, investors, and related onboarding data.
 * Keeps marketplace projects (Project) intact.
 *
 * Usage (from repo root):
 *   npm run db:reset-users -w @sanova/database
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const before = await prisma.user.count();
  console.log(`[reset-users] Users before: ${before}`);

  const payoutReceipts = await prisma.payoutReceipt.deleteMany();
  const payouts = await prisma.payoutHistory.deleteMany();
  const investments = await prisma.investment.deleteMany();
  const dividends = await prisma.dividendDistribution.deleteMany();
  const codes = await prisma.verificationCode.deleteMany();
  const nominations = await prisma.advisorNomination.deleteMany();
  const advisors = await prisma.advisor.deleteMany();
  const portfolios = await prisma.portfolio.deleteMany();

  await prisma.user.updateMany({ data: { investorId: null } });
  const investors = await prisma.investor.deleteMany();
  const users = await prisma.user.deleteMany();

  console.log('[reset-users] Deleted:', {
    payoutReceipts: payoutReceipts.count,
    payouts: payouts.count,
    investments: investments.count,
    dividends: dividends.count,
    verificationCodes: codes.count,
    advisorNominations: nominations.count,
    advisors: advisors.count,
    portfolios: portfolios.count,
    investors: investors.count,
    users: users.count
  });

  const after = await prisma.user.count();
  console.log(`[reset-users] Users after: ${after}`);
  console.log('[reset-users] Done. Projects were kept.');
}

main()
  .catch((error) => {
    console.error('[reset-users] Failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
