-- Investor rent payout preference (FIAT platform wallet vs USDC on-chain)
CREATE TYPE "RentPayoutPreference" AS ENUM ('FIAT', 'USDC');

ALTER TYPE "PlatformLedgerEntryType" ADD VALUE IF NOT EXISTS 'RENT_CREDIT';

ALTER TABLE "Investor"
  ADD COLUMN IF NOT EXISTS "rentPayoutPreference" "RentPayoutPreference" NOT NULL DEFAULT 'FIAT';
