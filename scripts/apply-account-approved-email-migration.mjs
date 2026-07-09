import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountApprovedEmailSentAt" TIMESTAMP(3);'
  );

  const check = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'accountApprovedEmailSentAt'
  `);

  console.log(JSON.stringify({ ok: true, column: check }, null, 2));
}

main()
  .catch((error) => {
    console.error('[apply-account-approved-email-migration] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
