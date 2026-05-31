-- Commission policy, advisor categories and accrual ledger

CREATE TYPE "AdvisorCategory" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');
CREATE TYPE "CommissionEventType" AS ENUM ('TOKEN_PURCHASE', 'RENT_DISTRIBUTION');
CREATE TYPE "CommissionAccrualStatus" AS ENUM ('ACCRUED', 'PAID', 'CANCELLED');
CREATE TYPE "CommissionRecipientRole" AS ENUM (
  'ADVISOR',
  'ADVISOR_MANAGER',
  'PLATFORM_OPEX',
  'ADMIN_OPS',
  'PLATFORM_RESIDUAL'
);

ALTER TABLE "Advisor"
  ADD COLUMN IF NOT EXISTS "category" "AdvisorCategory" NOT NULL DEFAULT 'BRONZE',
  ADD COLUMN IF NOT EXISTS "categoryQualifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "categoryEvaluatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Advisor_category_idx" ON "Advisor"("category");

CREATE TABLE IF NOT EXISTS "PlatformCommissionPolicy" (
  "id" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "name" TEXT NOT NULL DEFAULT 'Política principal',
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "purchaseFeeBps" INTEGER NOT NULL DEFAULT 200,
  "rentFeeBps" INTEGER NOT NULL DEFAULT 100,
  "platformOpexShareBps" INTEGER NOT NULL DEFAULT 2500,
  "adminOpsShareBps" INTEGER NOT NULL DEFAULT 3500,
  "advisorPoolShareBps" INTEGER NOT NULL DEFAULT 4000,
  "advisorDirectShareBps" INTEGER NOT NULL DEFAULT 5000,
  "managerShareBps" INTEGER NOT NULL DEFAULT 3000,
  "platformResidualBps" INTEGER NOT NULL DEFAULT 2000,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformCommissionPolicy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlatformCommissionPolicy_isActive_idx" ON "PlatformCommissionPolicy"("isActive");
CREATE INDEX IF NOT EXISTS "PlatformCommissionPolicy_effectiveFrom_idx" ON "PlatformCommissionPolicy"("effectiveFrom");

CREATE TABLE IF NOT EXISTS "AdvisorCategoryRule" (
  "id" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "category" "AdvisorCategory" NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "minBookAumUsd" DECIMAL(20,6) NOT NULL DEFAULT 0,
  "minActiveInvestors" INTEGER NOT NULL DEFAULT 1,
  "minQualifyingDays" INTEGER NOT NULL DEFAULT 0,
  "advisorMultiplierBps" INTEGER NOT NULL DEFAULT 10000,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdvisorCategoryRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdvisorCategoryRule_policyId_category_key"
  ON "AdvisorCategoryRule"("policyId", "category");
CREATE INDEX IF NOT EXISTS "AdvisorCategoryRule_policyId_sortOrder_idx"
  ON "AdvisorCategoryRule"("policyId", "sortOrder");

ALTER TABLE "AdvisorCategoryRule"
  ADD CONSTRAINT "AdvisorCategoryRule_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "PlatformCommissionPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "CommissionAccrual" (
  "id" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "eventType" "CommissionEventType" NOT NULL,
  "status" "CommissionAccrualStatus" NOT NULL DEFAULT 'ACCRUED',
  "grossAmountUsd" DECIMAL(20,6) NOT NULL,
  "feeAmountUsd" DECIMAL(20,6) NOT NULL,
  "investorId" TEXT,
  "advisorId" TEXT,
  "projectId" TEXT,
  "investmentId" TEXT,
  "recipientRole" "CommissionRecipientRole" NOT NULL,
  "recipientUserId" TEXT,
  "amountUsd" DECIMAL(20,6) NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  CONSTRAINT "CommissionAccrual_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommissionAccrual_idempotencyKey_key" ON "CommissionAccrual"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CommissionAccrual_policyId_idx" ON "CommissionAccrual"("policyId");
CREATE INDEX IF NOT EXISTS "CommissionAccrual_eventType_idx" ON "CommissionAccrual"("eventType");
CREATE INDEX IF NOT EXISTS "CommissionAccrual_status_idx" ON "CommissionAccrual"("status");
CREATE INDEX IF NOT EXISTS "CommissionAccrual_advisorId_idx" ON "CommissionAccrual"("advisorId");
CREATE INDEX IF NOT EXISTS "CommissionAccrual_investorId_idx" ON "CommissionAccrual"("investorId");
CREATE INDEX IF NOT EXISTS "CommissionAccrual_projectId_idx" ON "CommissionAccrual"("projectId");
CREATE INDEX IF NOT EXISTS "CommissionAccrual_createdAt_idx" ON "CommissionAccrual"("createdAt");

ALTER TABLE "CommissionAccrual"
  ADD CONSTRAINT "CommissionAccrual_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "PlatformCommissionPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommissionAccrual"
  ADD CONSTRAINT "CommissionAccrual_advisorId_fkey"
  FOREIGN KEY ("advisorId") REFERENCES "Advisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
