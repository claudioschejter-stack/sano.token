-- CreateTable
CREATE TABLE "MercadoPagoQrOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mpOrderId" TEXT NOT NULL,
    "mpPaymentId" TEXT,
    "externalReference" TEXT NOT NULL,
    "amountArs" DECIMAL(20,2) NOT NULL,
    "description" TEXT,
    "qrMode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "statusDetail" TEXT,
    "qrData" TEXT,
    "expiresAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MercadoPagoQrOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MercadoPagoQrOrder_mpOrderId_key" ON "MercadoPagoQrOrder"("mpOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "MercadoPagoQrOrder_idempotencyKey_key" ON "MercadoPagoQrOrder"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "MercadoPagoQrOrder_userId_externalReference_key" ON "MercadoPagoQrOrder"("userId", "externalReference");

-- CreateIndex
CREATE INDEX "MercadoPagoQrOrder_userId_idx" ON "MercadoPagoQrOrder"("userId");

-- CreateIndex
CREATE INDEX "MercadoPagoQrOrder_status_idx" ON "MercadoPagoQrOrder"("status");

-- CreateIndex
CREATE INDEX "MercadoPagoQrOrder_externalReference_idx" ON "MercadoPagoQrOrder"("externalReference");
