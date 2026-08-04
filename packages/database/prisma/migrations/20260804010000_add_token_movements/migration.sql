-- CreateEnum
CREATE TYPE "TokenMovementKind" AS ENUM ('USDC_PAYMENT', 'USDC_GAS_FEE', 'USDC_REFUND', 'RWA_SHARE_MINT', 'RWA_SHARE_BURN', 'RWA_SHARE_TRANSFER');

-- CreateEnum
CREATE TYPE "TokenMovementAsset" AS ENUM ('USDC', 'RWA_SHARE');

-- CreateTable
CREATE TABLE "TokenMovement" (
    "id" TEXT NOT NULL,
    "kind" "TokenMovementKind" NOT NULL,
    "asset" "TokenMovementAsset" NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL DEFAULT 8453,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "amountRaw" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3),
    "projectId" TEXT,
    "userId" TEXT,
    "investorId" TEXT,
    "paymentIntentId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TokenMovement_txHash_logIndex_key" ON "TokenMovement"("txHash", "logIndex");
CREATE INDEX "TokenMovement_kind_idx" ON "TokenMovement"("kind");
CREATE INDEX "TokenMovement_asset_idx" ON "TokenMovement"("asset");
CREATE INDEX "TokenMovement_contractAddress_idx" ON "TokenMovement"("contractAddress");
CREATE INDEX "TokenMovement_fromAddress_idx" ON "TokenMovement"("fromAddress");
CREATE INDEX "TokenMovement_toAddress_idx" ON "TokenMovement"("toAddress");
CREATE INDEX "TokenMovement_projectId_idx" ON "TokenMovement"("projectId");
CREATE INDEX "TokenMovement_userId_idx" ON "TokenMovement"("userId");
CREATE INDEX "TokenMovement_paymentIntentId_idx" ON "TokenMovement"("paymentIntentId");
CREATE INDEX "TokenMovement_blockNumber_idx" ON "TokenMovement"("blockNumber");
CREATE INDEX "TokenMovement_createdAt_idx" ON "TokenMovement"("createdAt");

-- AddForeignKey
ALTER TABLE "TokenMovement" ADD CONSTRAINT "TokenMovement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TokenMovement" ADD CONSTRAINT "TokenMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
