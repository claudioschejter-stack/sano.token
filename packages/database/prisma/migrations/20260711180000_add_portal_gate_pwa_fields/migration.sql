-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pwaPortalGateInstalledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pwaPortalGateDismissedAt" TIMESTAMP(3);
