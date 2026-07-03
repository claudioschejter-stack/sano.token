/**
 * Clears pending/enabled TOTP for one user by email (keeps KYC, wallet, etc.).
 *
 * Usage (from repo root, with DATABASE_URL pointing at prod/staging):
 *   node packages/database/prisma/reset-user-totp.mjs user@example.com
 *   node packages/database/prisma/reset-user-totp.mjs user@example.com --delete-user
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const deleteUser = process.argv.includes('--delete-user');

  if (!email) {
    console.error('Usage: node packages/database/prisma/reset-user-totp.mjs <email> [--delete-user]');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, totpEnabled: true, totpSecret: true, kycStatus: true, investorId: true }
  });

  if (!user) {
    console.error(`[reset-user-totp] No user found for ${email}`);
    process.exit(1);
  }

  if (deleteUser) {
    await prisma.backupCode.deleteMany({ where: { userId: user.id } });
    await prisma.verificationCode.deleteMany({ where: { userId: user.id } });
    await prisma.user.update({ where: { id: user.id }, data: { investorId: null } });
    if (user.investorId) {
      await prisma.investor.delete({ where: { id: user.investorId } }).catch(() => undefined);
    }
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`[reset-user-totp] Deleted user ${email}`);
    return;
  }

  const backupCodes = await prisma.backupCode.deleteMany({ where: { userId: user.id } });
  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpSecret: null,
      totpEnabled: false,
      failed2faAttempts: 0,
      locked2faUntil: null
    }
  });

  console.log('[reset-user-totp] Reset TOTP for', {
    email: user.email,
    hadSecret: Boolean(user.totpSecret),
    wasEnabled: user.totpEnabled,
    kycStatus: user.kycStatus,
    backupCodesRemoved: backupCodes.count
  });
  console.log('[reset-user-totp] User can sign in again and redo TOTP from /kyc?step=totp');
}

main()
  .catch((error) => {
    console.error('[reset-user-totp] Failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
