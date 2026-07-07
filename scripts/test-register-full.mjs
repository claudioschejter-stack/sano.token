/**
 * Full registerInvestor() against configured DATABASE_URL.
 * Usage: npx tsx scripts/test-register-full.mjs [email]
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { registerInvestor } from '../apps/web/src/lib/auth/registerService.ts';

const prisma = new PrismaClient();
const email = (process.argv[2] ?? 'drabragadin@hotmail.com').trim().toLowerCase();

async function main() {
  console.log('[test-register-full] email:', email);

  const existing = await prisma.user.findUnique({ where: { email } });
  console.log('[test-register-full] before:', existing ? { id: existing.id, hasPassword: Boolean(existing.passwordHash) } : null);

  try {
    const result = await registerInvestor({
      email,
      password: 'TestVictoria2026!',
      termsAccepted: true,
      fullName: 'Victoria Bragadin',
      phone: '+5491112345678'
    });
    console.log('[test-register-full] OK:', result);
  } catch (error) {
    console.error('[test-register-full] FAILED:', error);
    process.exitCode = 1;
    return;
  } finally {
    await prisma.user.delete({ where: { email } }).catch(() => {});
    console.log('[test-register-full] rolled back test user');
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});
