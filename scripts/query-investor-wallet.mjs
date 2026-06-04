/**
 * Print linked investor wallet + treasury config hints.
 *
 * Usage:
 *   node scripts/query-investor-wallet.mjs
 *   node scripts/query-investor-wallet.mjs --email claudioschejter@gmail.com
 *   node scripts/query-investor-wallet.mjs --env .env.vercel.production
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));

const envArgIndex = process.argv.indexOf('--env');
const envFile =
  envArgIndex >= 0 ? process.argv[envArgIndex + 1] : process.env.QUERY_WALLET_ENV ?? '.env';

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
  'claudioschejter@gmail.com';

const userSelect = {
  id: true,
  email: true,
  name: true,
  kycFullName: true,
  walletAddress: true,
  accountStatus: true,
  kycStatus: true,
  investor: {
    select: {
      id: true,
      email: true,
      fullName: true,
      walletAddress: true,
      kycStatus: true
    }
  }
};

function maskAddress(value) {
  if (!value?.trim()) {
    return null;
  }
  const v = value.trim();
  if (v.length < 12) {
    return v;
  }
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
}

function treasuryFromEnv() {
  const shared =
    process.env.STABLECOIN_TREASURY_ADDRESS?.trim() ||
    process.env.TOKEN_TREASURY_ADDRESS?.trim() ||
    process.env.SANOVA_TREASURY_ADDRESS?.trim() ||
    null;
  const base = process.env.BASE_STABLECOIN_TREASURY_ADDRESS?.trim() || shared;
  return {
    baseTreasury: base,
    baseTreasuryMasked: maskAddress(base),
    sharedTreasuryMasked: maskAddress(shared),
    coinbaseCommerce: Boolean(process.env.COINBASE_COMMERCE_API_KEY?.trim())
  };
}

const prisma = new PrismaClient();

async function main() {
  const user =
    (await prisma.user.findUnique({
      where: { email: INVESTOR_EMAIL },
      select: userSelect
    })) ??
    (await prisma.user.findFirst({
      where: { kycFullName: { contains: 'Schejter', mode: 'insensitive' } },
      select: userSelect
    }));

  if (!user) {
    console.error(`[query-investor-wallet] No user found for: ${INVESTOR_EMAIL}`);
    process.exit(1);
  }

  const linked =
    user.walletAddress?.trim()?.toLowerCase() ??
    user.investor?.walletAddress?.trim()?.toLowerCase() ??
    null;

  console.log('[query-investor-wallet]');
  console.log(
    JSON.stringify(
      {
        envFile,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          kycFullName: user.kycFullName,
          accountStatus: user.accountStatus,
          kycStatus: user.kycStatus
        },
        investor: user.investor
          ? {
              id: user.investor.id,
              email: user.investor.email,
              fullName: user.investor.fullName,
              kycStatus: user.investor.kycStatus
            }
          : null,
        linkedWallet: linked,
        linkedWalletMasked: maskAddress(linked),
        userWalletMatchesInvestor:
          !user.walletAddress ||
          !user.investor?.walletAddress ||
          user.walletAddress.toLowerCase() === user.investor.walletAddress.toLowerCase(),
        treasury: treasuryFromEnv()
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error('[query-investor-wallet] Failed:', error.message ?? error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
