/**
 * Reconcile an investor's canonical Sanova USDC receive wallet.
 *
 * Usage (from repo root, with prod env loaded):
 *   npx tsx scripts/ops/repair-sanova-receive-wallet.ts --email claudioschejter@hotmail.com
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../packages/database/.env') });
config({ path: resolve(__dirname, '../../.env') });
config({ path: resolve(__dirname, '../../apps/web/.env.local') });
if (process.env.DIRECT_URL?.trim()) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const emailArg = process.argv.indexOf('--email');
const email = (emailArg >= 0 ? process.argv[emailArg + 1] : process.env.SEED_INVESTOR_EMAIL)?.trim();
if (!email) {
  console.error('Usage: npx tsx scripts/ops/repair-sanova-receive-wallet.ts --email user@example.com');
  process.exit(1);
}

async function main() {
  // Dynamic import so web lib resolves after env is loaded.
  const { ensureSanovaReceiveWalletForUser } = await import(
    '../../apps/web/src/lib/investor/sanovaReceiveWallet.ts'
  );
  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true, walletAddress: true, investor: { select: { walletAddress: true } } }
  });
  if (!user) {
    throw new Error(`USER_NOT_FOUND:${email}`);
  }
  console.log('before', {
    email: user.email,
    userWallet: user.walletAddress,
    investorWallet: user.investor?.walletAddress
  });
  const result = await ensureSanovaReceiveWalletForUser(user.id);
  console.log('after', result);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
