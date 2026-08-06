-- The investor's identity on Bridge, which is not the same as their identity here.
--
-- Bridge verifies its own customers before it will issue a virtual account, and
-- does not accept another provider's verification unless the developer is
-- approved for its reliance model. So an investor Didit already cleared still
-- has a second onboarding to complete, and nothing remembered where it stood:
-- every page asked Bridge again, and an investor mid-verification looked
-- identical to one who had never started.

CREATE TABLE IF NOT EXISTS "BridgeCustomer" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "kycStatus" TEXT NOT NULL DEFAULT 'not_started',
  "tosStatus" TEXT NOT NULL DEFAULT 'pending',
  "kycLink" TEXT,
  "tosLink" TEXT,
  "endorsements" JSONB NOT NULL DEFAULT '[]',
  "lastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BridgeCustomer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BridgeCustomer_userId_key" ON "BridgeCustomer"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "BridgeCustomer_customerId_key" ON "BridgeCustomer"("customerId");
CREATE INDEX IF NOT EXISTS "BridgeCustomer_kycStatus_idx" ON "BridgeCustomer"("kycStatus");
