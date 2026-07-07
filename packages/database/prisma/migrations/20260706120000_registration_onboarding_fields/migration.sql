-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "registrationChannel" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingSuccessShownAt" TIMESTAMP(3);
