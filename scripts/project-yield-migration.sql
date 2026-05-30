-- Project operating balances (tenant rent) — separate from PlatformWallet (investors)

CREATE TYPE "ProjectOperatingEntryType" AS ENUM ('RENT_CREDIT', 'CONVERSION_DEBIT', 'MANUAL_ADJUSTMENT');
CREATE TYPE "ProjectYieldBatchStatus" AS ENUM ('QUEUED', 'CONVERTING', 'USDC_READY', 'DISTRIBUTING', 'COMPLETED', 'FAILED');
CREATE TYPE "YieldConversionRail" AS ENUM ('BRIDGE', 'COINBASE', 'EXCHANGE', 'MANUAL_USDC');

CREATE TABLE "ProjectOperatingAccount" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "balance" DECIMAL(20,6) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectOperatingAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectOperatingAccount_projectId_currency_key" ON "ProjectOperatingAccount"("projectId", "currency");
CREATE INDEX "ProjectOperatingAccount_projectId_idx" ON "ProjectOperatingAccount"("projectId");
CREATE INDEX "ProjectOperatingAccount_currency_idx" ON "ProjectOperatingAccount"("currency");

ALTER TABLE "ProjectOperatingAccount"
  ADD CONSTRAINT "ProjectOperatingAccount_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProjectYieldBatch" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "status" "ProjectYieldBatchStatus" NOT NULL DEFAULT 'QUEUED',
  "sourceCurrency" TEXT NOT NULL,
  "sourceAmount" DECIMAL(20,6) NOT NULL,
  "usdcAmount" DECIMAL(20,6),
  "conversionRail" "YieldConversionRail",
  "conversionRef" TEXT,
  "conversionTxHash" TEXT,
  "distributionTxHash" TEXT,
  "vaultAddress" TEXT,
  "chainId" INTEGER,
  "error" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ProjectYieldBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectYieldBatch_distributionTxHash_key" ON "ProjectYieldBatch"("distributionTxHash");
CREATE INDEX "ProjectYieldBatch_projectId_idx" ON "ProjectYieldBatch"("projectId");
CREATE INDEX "ProjectYieldBatch_status_idx" ON "ProjectYieldBatch"("status");
CREATE INDEX "ProjectYieldBatch_conversionRail_idx" ON "ProjectYieldBatch"("conversionRail");
CREATE INDEX "ProjectYieldBatch_createdAt_idx" ON "ProjectYieldBatch"("createdAt");

ALTER TABLE "ProjectYieldBatch"
  ADD CONSTRAINT "ProjectYieldBatch_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProjectOperatingLedgerEntry" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "type" "ProjectOperatingEntryType" NOT NULL,
  "amount" DECIMAL(20,6) NOT NULL,
  "currency" TEXT NOT NULL,
  "balanceAfter" DECIMAL(20,6) NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "batchId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectOperatingLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectOperatingLedgerEntry_idempotencyKey_key" ON "ProjectOperatingLedgerEntry"("idempotencyKey");
CREATE INDEX "ProjectOperatingLedgerEntry_accountId_idx" ON "ProjectOperatingLedgerEntry"("accountId");
CREATE INDEX "ProjectOperatingLedgerEntry_projectId_idx" ON "ProjectOperatingLedgerEntry"("projectId");
CREATE INDEX "ProjectOperatingLedgerEntry_type_idx" ON "ProjectOperatingLedgerEntry"("type");
CREATE INDEX "ProjectOperatingLedgerEntry_batchId_idx" ON "ProjectOperatingLedgerEntry"("batchId");
CREATE INDEX "ProjectOperatingLedgerEntry_createdAt_idx" ON "ProjectOperatingLedgerEntry"("createdAt");

ALTER TABLE "ProjectOperatingLedgerEntry"
  ADD CONSTRAINT "ProjectOperatingLedgerEntry_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "ProjectOperatingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectOperatingLedgerEntry"
  ADD CONSTRAINT "ProjectOperatingLedgerEntry_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "ProjectYieldBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
