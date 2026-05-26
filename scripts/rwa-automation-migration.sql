-- Idempotent production migration for RWA automation operations.
-- Safe to run multiple times against Supabase/Postgres.

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "projectId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "auditHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InvestorAllowlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "txHash" TEXT,
    "chainId" INTEGER,
    "updatedByUserId" TEXT,
    "auditHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestorAllowlist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AutomationJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminAuditLog_actorUserId_idx" ON "AdminAuditLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetUserId_idx" ON "AdminAuditLog"("targetUserId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_projectId_idx" ON "AdminAuditLog"("projectId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_idx" ON "AdminAuditLog"("action");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "InvestorAllowlist_projectId_walletAddress_key" ON "InvestorAllowlist"("projectId", "walletAddress");
CREATE INDEX IF NOT EXISTS "InvestorAllowlist_userId_idx" ON "InvestorAllowlist"("userId");
CREATE INDEX IF NOT EXISTS "InvestorAllowlist_projectId_idx" ON "InvestorAllowlist"("projectId");
CREATE INDEX IF NOT EXISTS "InvestorAllowlist_walletAddress_idx" ON "InvestorAllowlist"("walletAddress");
CREATE INDEX IF NOT EXISTS "InvestorAllowlist_approved_idx" ON "InvestorAllowlist"("approved");

CREATE INDEX IF NOT EXISTS "AutomationJob_projectId_idx" ON "AutomationJob"("projectId");
CREATE INDEX IF NOT EXISTS "AutomationJob_step_idx" ON "AutomationJob"("step");
CREATE INDEX IF NOT EXISTS "AutomationJob_status_idx" ON "AutomationJob"("status");
CREATE INDEX IF NOT EXISTS "AutomationJob_runAfter_idx" ON "AutomationJob"("runAfter");
CREATE INDEX IF NOT EXISTS "AutomationJob_lockedAt_idx" ON "AutomationJob"("lockedAt");

