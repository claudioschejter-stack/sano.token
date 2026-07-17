-- AlterTable
ALTER TABLE "PlatformWithdrawal" ADD COLUMN IF NOT EXISTS "payoutDetails" JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "LinkedCryptoWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'BASE',
    "provider" TEXT NOT NULL,
    "label" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "LinkedCryptoWallet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LinkedCryptoWallet_userId_network_address_key" ON "LinkedCryptoWallet"("userId", "network", "address");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LinkedCryptoWallet_userId_idx" ON "LinkedCryptoWallet"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LinkedCryptoWallet_userId_isDefault_idx" ON "LinkedCryptoWallet"("userId", "isDefault");

-- CreateTable
CREATE TABLE IF NOT EXISTS "LinkedFiatIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "label" TEXT,
    "capturedFrom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkedFiatIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LinkedFiatIdentity_userId_provider_identifier_key" ON "LinkedFiatIdentity"("userId", "provider", "identifier");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LinkedFiatIdentity_userId_idx" ON "LinkedFiatIdentity"("userId");

-- Backfill: seed LinkedCryptoWallet from existing single-wallet columns so
-- history isn't empty for investors who already linked a wallet.
INSERT INTO "LinkedCryptoWallet" ("id", "userId", "address", "network", "provider", "isDefault", "linkedAt")
SELECT
  'seed_' || u."id",
  u."id",
  LOWER(u."walletAddress"),
  'BASE',
  COALESCE(u."walletProvider", 'Coinbase Wallet'),
  true,
  u."createdAt"
FROM "User" u
WHERE u."walletAddress" IS NOT NULL
  AND u."walletAddress" NOT LIKE 'pending:%'
ON CONFLICT ("userId", "network", "address") DO NOTHING;
