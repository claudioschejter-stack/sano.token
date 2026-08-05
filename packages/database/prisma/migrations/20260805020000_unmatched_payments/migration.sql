-- Webhooks answered `ignored: unmatched_reference` for money that had already
-- arrived, so a transfer without a usable reference left no trace at all.

CREATE TYPE "UnmatchedPaymentStatus" AS ENUM ('PENDING', 'ASSIGNED', 'DISMISSED');

CREATE TABLE "UnmatchedPayment" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "externalReference" TEXT,
    "amount" DECIMAL(20,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "amountUsd" DECIMAL(20,6),
    "payerName" TEXT,
    "payerTaxId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "UnmatchedPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedKind" TEXT,
    "resolvedRef" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "note" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnmatchedPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UnmatchedPayment_provider_providerPaymentId_key"
    ON "UnmatchedPayment"("provider", "providerPaymentId");
CREATE INDEX "UnmatchedPayment_status_idx" ON "UnmatchedPayment"("status");
CREATE INDEX "UnmatchedPayment_occurredAt_idx" ON "UnmatchedPayment"("occurredAt");
