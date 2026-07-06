-- KYC archive tables, invite phone, investor identity fields, prize campaigns

-- CreateEnum
CREATE TYPE "KycMediaKind" AS ENUM ('PORTRAIT', 'DOCUMENT_FRONT', 'DOCUMENT_BACK', 'SELFIE');
CREATE TYPE "KycVerificationProvider" AS ENUM ('DIDIT');
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "kycPersonalNumber" TEXT;
ALTER TABLE "User" ADD COLUMN "kycIssuingState" TEXT;
ALTER TABLE "User" ADD COLUMN "kycPortraitPath" TEXT;

ALTER TABLE "TeamInvite" ADD COLUMN "phone" TEXT;

ALTER TABLE "Investor" ADD COLUMN "phone" TEXT;
ALTER TABLE "Investor" ADD COLUMN "dateOfBirth" TEXT;
ALTER TABLE "Investor" ADD COLUMN "nationality" TEXT;
ALTER TABLE "Investor" ADD COLUMN "portraitPath" TEXT;

-- CreateTable
CREATE TABLE "KycVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "KycVerificationProvider" NOT NULL DEFAULT 'DIDIT',
    "sessionId" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "pendingContact" BOOLEAN NOT NULL DEFAULT false,
    "rawWebhookPayload" JSONB,
    "rawDecisionPayload" JSONB,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KycDocument" (
    "id" TEXT NOT NULL,
    "kycVerificationId" TEXT NOT NULL,
    "kind" "KycMediaKind" NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "checksum" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrizeEntry" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "investorId" TEXT,
    "kycVerificationId" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "fullName" TEXT,
    "portraitPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KycVerification_userId_idx" ON "KycVerification"("userId");
CREATE INDEX "KycVerification_sessionId_idx" ON "KycVerification"("sessionId");
CREATE INDEX "KycVerification_pendingContact_idx" ON "KycVerification"("pendingContact");
CREATE UNIQUE INDEX "KycVerification_userId_sessionId_key" ON "KycVerification"("userId", "sessionId");

CREATE INDEX "KycDocument_kycVerificationId_idx" ON "KycDocument"("kycVerificationId");
CREATE INDEX "KycDocument_kind_idx" ON "KycDocument"("kind");

CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

CREATE INDEX "PrizeEntry_campaignId_idx" ON "PrizeEntry"("campaignId");
CREATE INDEX "PrizeEntry_userId_idx" ON "PrizeEntry"("userId");
CREATE UNIQUE INDEX "PrizeEntry_campaignId_userId_key" ON "PrizeEntry"("campaignId", "userId");

-- AddForeignKey
ALTER TABLE "KycVerification" ADD CONSTRAINT "KycVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_kycVerificationId_fkey" FOREIGN KEY ("kycVerificationId") REFERENCES "KycVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrizeEntry" ADD CONSTRAINT "PrizeEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrizeEntry" ADD CONSTRAINT "PrizeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrizeEntry" ADD CONSTRAINT "PrizeEntry_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrizeEntry" ADD CONSTRAINT "PrizeEntry_kycVerificationId_fkey" FOREIGN KEY ("kycVerificationId") REFERENCES "KycVerification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
