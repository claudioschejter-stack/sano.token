import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../packages/database/.env') });
config({ path: resolve(__dirname, '../.env') });
if (process.env.DIRECT_URL?.trim()) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "TeamInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TeamInvite" (
      "id" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "name" TEXT,
      "role" "SystemRole" NOT NULL,
      "uplineAdvisorId" TEXT,
      "tokenHash" TEXT NOT NULL,
      "status" "TeamInviteStatus" NOT NULL DEFAULT 'PENDING',
      "invitedByUserId" TEXT NOT NULL,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "acceptedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TeamInvite_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "TeamInvite_tokenHash_key" ON "TeamInvite"("tokenHash");`
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TeamInvite_email_idx" ON "TeamInvite"("email");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TeamInvite_status_idx" ON "TeamInvite"("status");`);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "TeamInvite_expiresAt_idx" ON "TeamInvite"("expiresAt");`
  );

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "TeamInvite"
        ADD CONSTRAINT "TeamInvite_invitedByUserId_fkey"
        FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "TeamInvite"
        ADD CONSTRAINT "TeamInvite_uplineAdvisorId_fkey"
        FOREIGN KEY ("uplineAdvisorId") REFERENCES "Advisor"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  console.log('[ensure-team-invite-table] OK');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
