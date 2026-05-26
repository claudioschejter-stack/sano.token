-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "InvestorType" AS ENUM ('RETAIL', 'INSTITUTIONAL');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InvestmentStatus" AS ENUM ('ACTIVE', 'PENDING', 'LIQUIDATED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "FiscalRegime" AS ENUM ('LEY_19640', 'GENERAL');

-- CreateEnum
CREATE TYPE "AdvisorTier" AS ENUM ('JUNIOR', 'SENIOR', 'PARTNER');

-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('ADMIN', 'ADVISOR_MANAGER', 'ADVISOR', 'INVESTOR', 'TREASURY', 'OPERATOR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "walletAddress" TEXT,
    "systemRole" "SystemRole" NOT NULL DEFAULT 'INVESTOR',
    "passwordHash" TEXT,
    "oauthProvider" TEXT,
    "oauthProviderId" TEXT,
    "investorId" TEXT,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "kycProviderId" TEXT,
    "jurisdiction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advisor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "uplineId" TEXT,
    "tier" "AdvisorTier" NOT NULL DEFAULT 'JUNIOR',
    "accumulatedVolume" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "commissionRateBps" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advisor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investor" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "investorType" "InvestorType" NOT NULL DEFAULT 'RETAIL',
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "kycVerifiedAt" TIMESTAMP(3),
    "originOfFunds" TEXT,
    "brokerAccountRef" TEXT,
    "dividendPreference" TEXT NOT NULL DEFAULT 'CASH',
    "totalCapital" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "marginDebt" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "ltv" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalCapital" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "activeMarginDebt" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "ltv" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "image" TEXT,
    "totalTokens" INTEGER NOT NULL,
    "availableTokens" INTEGER NOT NULL,
    "pricePerToken" DECIMAL(20,6) NOT NULL,
    "targetYield" DECIMAL(8,4) NOT NULL,
    "fiscalRegime" "FiscalRegime" NOT NULL DEFAULT 'LEY_19640',
    "fiscalLawRef" TEXT NOT NULL DEFAULT 'Ley 19.640',
    "taxExemptionNote" TEXT,
    "jurisdiction" TEXT,
    "promoterEntity" TEXT,
    "contractAddress" TEXT,
    "usdcVaultAddress" TEXT,
    "vaultAddress" TEXT,
    "vaultFundingStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "vaultFundingAmount" TEXT,
    "vaultFundingTxHash" TEXT,
    "vaultFundingError" TEXT,
    "chainId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "purchasePriceUsd" DECIMAL(20,6) NOT NULL,
    "status" "InvestmentStatus" NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutHistory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "totalAmountPaid" DECIMAL(20,6) NOT NULL,
    "txHash" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "debtOffsetUsd" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "liquidPaidUsd" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutReceipt" (
    "id" TEXT NOT NULL,
    "payoutHistoryId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "amountReceived" DECIMAL(20,6) NOT NULL,
    "debtCancelledUsd" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "walletSentTo" TEXT NOT NULL,

    CONSTRAINT "PayoutReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DividendDistribution" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platformUserId" TEXT,
    "amount" DECIMAL(20,6) NOT NULL,
    "appliedAmount" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "txHash" TEXT,
    "distributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "appliedToMargin" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "DividendDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainEvent" (
    "id" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "payload" JSONB,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockchainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "User_investorId_key" ON "User"("investorId");

-- CreateIndex
CREATE INDEX "User_walletAddress_idx" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "User_investorId_idx" ON "User"("investorId");

-- CreateIndex
CREATE INDEX "User_kycStatus_idx" ON "User"("kycStatus");

-- CreateIndex
CREATE INDEX "User_jurisdiction_idx" ON "User"("jurisdiction");

-- CreateIndex
CREATE UNIQUE INDEX "Advisor_userId_key" ON "Advisor"("userId");

-- CreateIndex
CREATE INDEX "Advisor_uplineId_idx" ON "Advisor"("uplineId");

-- CreateIndex
CREATE INDEX "Advisor_tier_idx" ON "Advisor"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "Investor_email_key" ON "Investor"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Investor_cuit_key" ON "Investor"("cuit");

-- CreateIndex
CREATE UNIQUE INDEX "Investor_walletAddress_key" ON "Investor"("walletAddress");

-- CreateIndex
CREATE INDEX "Investor_kycStatus_idx" ON "Investor"("kycStatus");

-- CreateIndex
CREATE INDEX "Investor_walletAddress_idx" ON "Investor"("walletAddress");

-- CreateIndex
CREATE INDEX "Investor_brokerAccountRef_idx" ON "Investor"("brokerAccountRef");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_userId_key" ON "Portfolio"("userId");

-- CreateIndex
CREATE INDEX "Portfolio_userId_idx" ON "Portfolio"("userId");

-- CreateIndex
CREATE INDEX "Project_fiscalRegime_idx" ON "Project"("fiscalRegime");

-- CreateIndex
CREATE INDEX "Project_isActive_idx" ON "Project"("isActive");

-- CreateIndex
CREATE INDEX "Project_isActive_createdAt_idx" ON "Project"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "Investment_investorId_idx" ON "Investment"("investorId");

-- CreateIndex
CREATE INDEX "Investment_projectId_idx" ON "Investment"("projectId");

-- CreateIndex
CREATE INDEX "Investment_status_idx" ON "Investment"("status");

-- CreateIndex
CREATE INDEX "Investment_purchasedAt_idx" ON "Investment"("purchasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Investment_investorId_projectId_txHash_key" ON "Investment"("investorId", "projectId", "txHash");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutHistory_txHash_key" ON "PayoutHistory"("txHash");

-- CreateIndex
CREATE INDEX "PayoutHistory_projectId_idx" ON "PayoutHistory"("projectId");

-- CreateIndex
CREATE INDEX "PayoutHistory_status_idx" ON "PayoutHistory"("status");

-- CreateIndex
CREATE INDEX "PayoutHistory_executedAt_idx" ON "PayoutHistory"("executedAt");

-- CreateIndex
CREATE INDEX "PayoutReceipt_payoutHistoryId_idx" ON "PayoutReceipt"("payoutHistoryId");

-- CreateIndex
CREATE INDEX "PayoutReceipt_investorId_idx" ON "PayoutReceipt"("investorId");

-- CreateIndex
CREATE UNIQUE INDEX "DividendDistribution_txHash_key" ON "DividendDistribution"("txHash");

-- CreateIndex
CREATE INDEX "DividendDistribution_userId_idx" ON "DividendDistribution"("userId");

-- CreateIndex
CREATE INDEX "DividendDistribution_platformUserId_idx" ON "DividendDistribution"("platformUserId");

-- CreateIndex
CREATE INDEX "DividendDistribution_assetId_idx" ON "DividendDistribution"("assetId");

-- CreateIndex
CREATE INDEX "BlockchainEvent_eventName_idx" ON "BlockchainEvent"("eventName");

-- CreateIndex
CREATE INDEX "BlockchainEvent_contractAddress_idx" ON "BlockchainEvent"("contractAddress");

-- CreateIndex
CREATE INDEX "BlockchainEvent_processedAt_idx" ON "BlockchainEvent"("processedAt");

-- CreateIndex
CREATE INDEX "BlockchainEvent_txHash_idx" ON "BlockchainEvent"("txHash");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainEvent_txHash_eventName_contractAddress_key" ON "BlockchainEvent"("txHash", "eventName", "contractAddress");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advisor" ADD CONSTRAINT "Advisor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advisor" ADD CONSTRAINT "Advisor_uplineId_fkey" FOREIGN KEY ("uplineId") REFERENCES "Advisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutHistory" ADD CONSTRAINT "PayoutHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutReceipt" ADD CONSTRAINT "PayoutReceipt_payoutHistoryId_fkey" FOREIGN KEY ("payoutHistoryId") REFERENCES "PayoutHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutReceipt" ADD CONSTRAINT "PayoutReceipt_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DividendDistribution" ADD CONSTRAINT "DividendDistribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DividendDistribution" ADD CONSTRAINT "DividendDistribution_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
