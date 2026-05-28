import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

function splitSqlStatements(sql) {
  const statements = [];
  let buffer = '';
  let index = 0;

  while (index < sql.length) {
    if (sql[index] === '$') {
      const match = sql.slice(index).match(/^\$([A-Za-z0-9_]*)\$/);
      if (match) {
        const tag = match[0];
        buffer += tag;
        index += tag.length;
        const end = sql.indexOf(tag, index);
        if (end === -1) {
          throw new Error('Unclosed dollar-quoted SQL block');
        }
        buffer += sql.slice(index, end + tag.length);
        index = end + tag.length;
        continue;
      }
    }

    if (sql[index] === ';') {
      const trimmed = buffer.trim();
      if (trimmed && !trimmed.startsWith('--')) {
        statements.push(trimmed);
      }
      buffer = '';
      index += 1;
      continue;
    }

    buffer += sql[index];
    index += 1;
  }

  const trailing = buffer.trim();
  if (trailing && !trailing.startsWith('--')) {
    statements.push(trailing);
  }

  return statements;
}

async function execStatement(statement, index, total) {
  try {
    await prisma.$executeRawUnsafe(statement);
  } catch (error) {
    const code = error?.meta?.code;
    if (code === '42710' || code === '42P07' || code === '42701') {
      return;
    }
    console.error(`[apply-stablecoin-payments-migration] statement ${index + 1}/${total} failed`);
    console.error(statement.slice(0, 200));
    throw error;
  }
}

async function main() {
  const sql = await readFile(join(__dirname, 'stablecoin-payments-migration.sql'), 'utf8');
  const statements = splitSqlStatements(sql);

  for (const [index, statement] of statements.entries()) {
    await execStatement(statement, index, statements.length);
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
      )
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
