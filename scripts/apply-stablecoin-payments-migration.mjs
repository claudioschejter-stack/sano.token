import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

async function main() {
  const sql = await readFile(join(__dirname, 'stablecoin-payments-migration.sql'), 'utf8');
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  const checks = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'PaymentIntent',
        'PaymentEvent',
        'StablecoinWallet',
        'PlatformWalletAccount',
        'PlatformWalletLedgerEntry',
        'PlatformDeposit',
        'PlatformWithdrawal',
        'PortfolioSnapshot'
    ORDER BY table_name
  `);

  console.log(JSON.stringify({ ok: true, tables: checks }, null, 2));
}

main()
  .catch((error) => {
    console.error('[apply-stablecoin-payments-migration]', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
