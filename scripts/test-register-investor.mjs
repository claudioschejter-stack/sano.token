/**
 * Dry-run registerInvestor against the configured DATABASE_URL.
 * Usage: node scripts/test-register-investor.mjs [email]
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const email = (process.argv[2] ?? 'bragadin67@gmail.com').trim().toLowerCase();
const password = 'TestVictoria2026!';

async function main() {
  console.log('[test-register] email:', email);

  const existing = await prisma.user.findUnique({ where: { email } });
  console.log('[test-register] existing user:', existing ? {
    id: existing.id,
    investorAccessEnabled: existing.investorAccessEnabled,
    hasPassword: Boolean(existing.passwordHash),
    oauthProvider: existing.oauthProvider
  } : null);

  const attemptTotal = await prisma.registrationAttempt.count();
  console.log('[test-register] registrationAttempt total rows:', attemptTotal);

  if (existing?.passwordHash) {
    console.log('[test-register] SKIP: email already has password');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      name: email.split('@')[0],
      systemRole: 'INVESTOR',
      investorAccessEnabled: true,
      termsAcceptedAt: new Date()
    },
    update: {
      passwordHash,
      investorAccessEnabled: true,
      termsAcceptedAt: new Date()
    }
  });

  console.log('[test-register] upsert OK:', {
    id: user.id,
    email: user.email,
    investorAccessEnabled: user.investorAccessEnabled
  });

  // Roll back test user so Victoria can register for real
  await prisma.user.delete({ where: { id: user.id } });
  console.log('[test-register] rolled back test user (deleted)');
}

main()
  .catch((error) => {
    console.error('[test-register] FAILED:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
