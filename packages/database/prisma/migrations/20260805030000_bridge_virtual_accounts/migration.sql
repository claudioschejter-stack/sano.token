-- Bridge issues one virtual account per customer, so an incoming wire is
-- identified by which account received it. Nothing recorded that mapping, so a
-- deposit without a usable reference could not be attributed to anyone.

CREATE TABLE "BridgeVirtualAccount" (
    "id" TEXT NOT NULL,
    "virtualAccountId" TEXT NOT NULL,
    "bridgeCustomerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BridgeVirtualAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BridgeVirtualAccount_virtualAccountId_key"
    ON "BridgeVirtualAccount"("virtualAccountId");
CREATE INDEX "BridgeVirtualAccount_userId_idx" ON "BridgeVirtualAccount"("userId");
CREATE INDEX "BridgeVirtualAccount_bridgeCustomerId_idx"
    ON "BridgeVirtualAccount"("bridgeCustomerId");
