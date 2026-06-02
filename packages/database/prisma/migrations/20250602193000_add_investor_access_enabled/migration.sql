-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "investorAccessEnabled" BOOLEAN NOT NULL DEFAULT false;
