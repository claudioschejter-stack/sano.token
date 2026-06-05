-- Persist deploy/automation locks in DB (cross-instance, survives cold starts).
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "automationLockStep" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "automationLockExpiresAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "automationLockOwner" TEXT;

CREATE INDEX IF NOT EXISTS "Project_automationLockExpiresAt_idx" ON "Project"("automationLockExpiresAt");
