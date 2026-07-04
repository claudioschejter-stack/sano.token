-- CreateTable
CREATE TABLE "MercadoPagoPixPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mpPaymentId" TEXT NOT NULL,
    "externalReference" TEXT NOT NULL,
    "amountBrl" DECIMAL(20,2) NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "statusDetail" TEXT,
    "qrCode" TEXT,
    "qrCodeBase64" TEXT,
    "expiresAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MercadoPagoPixPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MercadoPagoPixPayment_mpPaymentId_key" ON "MercadoPagoPixPayment"("mpPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "MercadoPagoPixPayment_idempotencyKey_key" ON "MercadoPagoPixPayment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "MercadoPagoPixPayment_userId_externalReference_key" ON "MercadoPagoPixPayment"("userId", "externalReference");

-- CreateIndex
CREATE INDEX "MercadoPagoPixPayment_userId_idx" ON "MercadoPagoPixPayment"("userId");

-- CreateIndex
CREATE INDEX "MercadoPagoPixPayment_status_idx" ON "MercadoPagoPixPayment"("status");

-- CreateIndex
CREATE INDEX "MercadoPagoPixPayment_externalReference_idx" ON "MercadoPagoPixPayment"("externalReference");
