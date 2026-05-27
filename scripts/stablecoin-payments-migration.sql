-- Idempotent production migration for stablecoin wallets and payment intents.
-- Safe to run multiple times against Supabase/Postgres.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentMethod') THEN
    CREATE TYPE "PaymentMethod" AS ENUM ('INTERNAL_BALANCE', 'USDC_ONCHAIN', 'LOCAL_RAIL', 'BRIDGE', 'TRANSAK', 'RAMP', 'STRIPE', 'MERCADO_PAGO', 'COINBASE', 'CUSTODIAL_STABLECOIN');
  END IF;
END $$;

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'INTERNAL_BALANCE';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'LOCAL_RAIL';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'BRIDGE';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'TRANSAK';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'RAMP';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentIntentStatus') THEN
    CREATE TYPE "PaymentIntentStatus" AS ENUM ('PENDING', 'REQUIRES_PAYMENT', 'MANUAL_REVIEW', 'CONFIRMED', 'FAILED', 'EXPIRED', 'REFUNDED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlatformLedgerEntryType') THEN
    CREATE TYPE "PlatformLedgerEntryType" AS ENUM ('DEPOSIT_CREDIT', 'TOKEN_PURCHASE_DEBIT', 'REFUND_CREDIT', 'MANUAL_ADJUSTMENT');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlatformLedgerEntryStatus') THEN
    CREATE TYPE "PlatformLedgerEntryStatus" AS ENUM ('PENDING', 'POSTED', 'REVERSED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlatformDepositStatus') THEN
    CREATE TYPE "PlatformDepositStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED', 'MANUAL_REVIEW');
  END IF;
END $$;

ALTER TYPE "PaymentIntentStatus" ADD VALUE IF NOT EXISTS 'MANUAL_REVIEW';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StablecoinWalletType') THEN
    CREATE TYPE "StablecoinWalletType" AS ENUM ('EXTERNAL', 'CUSTODIAL', 'TREASURY');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StablecoinWalletStatus') THEN
    CREATE TYPE "StablecoinWalletStatus" AS ENUM ('ACTIVE', 'PENDING', 'DISABLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PaymentIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "investorId" TEXT,
    "projectId" TEXT NOT NULL,
    "investmentId" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'PENDING',
    "tokenCount" INTEGER NOT NULL,
    "amountUsd" DECIMAL(20,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stablecoinSymbol" TEXT,
    "chainId" INTEGER,
    "payerWalletAddress" TEXT,
    "payToAddress" TEXT,
    "txHash" TEXT,
    "provider" TEXT,
    "providerPaymentId" TEXT,
    "providerCheckoutUrl" TEXT,
    "idempotencyKey" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PaymentEvent" (
    "id" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT,
    "txHash" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StablecoinWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "investorId" TEXT,
    "address" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "type" "StablecoinWalletType" NOT NULL DEFAULT 'EXTERNAL',
    "status" "StablecoinWalletStatus" NOT NULL DEFAULT 'ACTIVE',
    "label" TEXT,
    "provider" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StablecoinWallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlatformWalletAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "investorId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "balance" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformWalletAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlatformWalletLedgerEntry" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "investorId" TEXT,
    "type" "PlatformLedgerEntryType" NOT NULL,
    "status" "PlatformLedgerEntryStatus" NOT NULL DEFAULT 'POSTED',
    "amount" DECIMAL(20,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "balanceAfter" DECIMAL(20,6) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "depositId" TEXT,
    "investmentId" TEXT,
    "txHash" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformWalletLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlatformDeposit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "investorId" TEXT,
    "status" "PlatformDepositStatus" NOT NULL DEFAULT 'PENDING',
    "amountUsd" DECIMAL(20,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "method" "PaymentMethod" NOT NULL,
    "stablecoinNetwork" TEXT,
    "stablecoinSymbol" TEXT,
    "payerWalletAddress" TEXT,
    "payToAddress" TEXT,
    "txHash" TEXT,
    "provider" TEXT,
    "providerPaymentId" TEXT,
    "providerCheckoutUrl" TEXT,
    "idempotencyKey" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformDeposit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "investorId" TEXT,
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "totalValueUsd" DECIMAL(20,6) NOT NULL,
    "rwaValueUsd" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "stablecoinUsd" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "fiatUsd" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "availableUsd" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "debtUsd" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "ltv" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "positions" JSONB NOT NULL DEFAULT '[]',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentIntent_txHash_key" ON "PaymentIntent"("txHash") WHERE "txHash" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentIntent_idempotencyKey_key" ON "PaymentIntent"("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "PaymentIntent_userId_idx" ON "PaymentIntent"("userId");
CREATE INDEX IF NOT EXISTS "PaymentIntent_investorId_idx" ON "PaymentIntent"("investorId");
CREATE INDEX IF NOT EXISTS "PaymentIntent_projectId_idx" ON "PaymentIntent"("projectId");
CREATE INDEX IF NOT EXISTS "PaymentIntent_investmentId_idx" ON "PaymentIntent"("investmentId");
CREATE INDEX IF NOT EXISTS "PaymentIntent_method_idx" ON "PaymentIntent"("method");
CREATE INDEX IF NOT EXISTS "PaymentIntent_status_idx" ON "PaymentIntent"("status");
CREATE INDEX IF NOT EXISTS "PaymentIntent_expiresAt_idx" ON "PaymentIntent"("expiresAt");
CREATE INDEX IF NOT EXISTS "PaymentIntent_provider_providerPaymentId_idx" ON "PaymentIntent"("provider", "providerPaymentId");

CREATE INDEX IF NOT EXISTS "PaymentEvent_paymentIntentId_idx" ON "PaymentEvent"("paymentIntentId");
CREATE INDEX IF NOT EXISTS "PaymentEvent_type_idx" ON "PaymentEvent"("type");
CREATE INDEX IF NOT EXISTS "PaymentEvent_provider_idx" ON "PaymentEvent"("provider");
CREATE INDEX IF NOT EXISTS "PaymentEvent_txHash_idx" ON "PaymentEvent"("txHash");
CREATE INDEX IF NOT EXISTS "PaymentEvent_createdAt_idx" ON "PaymentEvent"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "StablecoinWallet_address_key" ON "StablecoinWallet"("address");
CREATE INDEX IF NOT EXISTS "StablecoinWallet_userId_idx" ON "StablecoinWallet"("userId");
CREATE INDEX IF NOT EXISTS "StablecoinWallet_investorId_idx" ON "StablecoinWallet"("investorId");
CREATE INDEX IF NOT EXISTS "StablecoinWallet_chainId_idx" ON "StablecoinWallet"("chainId");
CREATE INDEX IF NOT EXISTS "StablecoinWallet_type_idx" ON "StablecoinWallet"("type");
CREATE INDEX IF NOT EXISTS "StablecoinWallet_status_idx" ON "StablecoinWallet"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformWalletAccount_userId_currency_key" ON "PlatformWalletAccount"("userId", "currency");
CREATE INDEX IF NOT EXISTS "PlatformWalletAccount_userId_idx" ON "PlatformWalletAccount"("userId");
CREATE INDEX IF NOT EXISTS "PlatformWalletAccount_investorId_idx" ON "PlatformWalletAccount"("investorId");
CREATE INDEX IF NOT EXISTS "PlatformWalletAccount_status_idx" ON "PlatformWalletAccount"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformWalletLedgerEntry_idempotencyKey_key" ON "PlatformWalletLedgerEntry"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "PlatformWalletLedgerEntry_accountId_idx" ON "PlatformWalletLedgerEntry"("accountId");
CREATE INDEX IF NOT EXISTS "PlatformWalletLedgerEntry_userId_idx" ON "PlatformWalletLedgerEntry"("userId");
CREATE INDEX IF NOT EXISTS "PlatformWalletLedgerEntry_investorId_idx" ON "PlatformWalletLedgerEntry"("investorId");
CREATE INDEX IF NOT EXISTS "PlatformWalletLedgerEntry_type_idx" ON "PlatformWalletLedgerEntry"("type");
CREATE INDEX IF NOT EXISTS "PlatformWalletLedgerEntry_status_idx" ON "PlatformWalletLedgerEntry"("status");
CREATE INDEX IF NOT EXISTS "PlatformWalletLedgerEntry_paymentIntentId_idx" ON "PlatformWalletLedgerEntry"("paymentIntentId");
CREATE INDEX IF NOT EXISTS "PlatformWalletLedgerEntry_depositId_idx" ON "PlatformWalletLedgerEntry"("depositId");
CREATE INDEX IF NOT EXISTS "PlatformWalletLedgerEntry_investmentId_idx" ON "PlatformWalletLedgerEntry"("investmentId");
CREATE INDEX IF NOT EXISTS "PlatformWalletLedgerEntry_txHash_idx" ON "PlatformWalletLedgerEntry"("txHash");
CREATE INDEX IF NOT EXISTS "PlatformWalletLedgerEntry_createdAt_idx" ON "PlatformWalletLedgerEntry"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformDeposit_txHash_key" ON "PlatformDeposit"("txHash") WHERE "txHash" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformDeposit_idempotencyKey_key" ON "PlatformDeposit"("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "PlatformDeposit_userId_idx" ON "PlatformDeposit"("userId");
CREATE INDEX IF NOT EXISTS "PlatformDeposit_investorId_idx" ON "PlatformDeposit"("investorId");
CREATE INDEX IF NOT EXISTS "PlatformDeposit_status_idx" ON "PlatformDeposit"("status");
CREATE INDEX IF NOT EXISTS "PlatformDeposit_method_idx" ON "PlatformDeposit"("method");
CREATE INDEX IF NOT EXISTS "PlatformDeposit_expiresAt_idx" ON "PlatformDeposit"("expiresAt");
CREATE INDEX IF NOT EXISTS "PlatformDeposit_provider_providerPaymentId_idx" ON "PlatformDeposit"("provider", "providerPaymentId");

ALTER TYPE "PlatformLedgerEntryType" ADD VALUE IF NOT EXISTS 'WITHDRAWAL_DEBIT';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlatformWithdrawalStatus') THEN
    CREATE TYPE "PlatformWithdrawalStatus" AS ENUM ('PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED', 'CANCELLED', 'MANUAL_REVIEW');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlatformWithdrawalMethod') THEN
    CREATE TYPE "PlatformWithdrawalMethod" AS ENUM ('STABLECOIN', 'FIAT');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PlatformWithdrawal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "investorId" TEXT,
    "status" "PlatformWithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "method" "PlatformWithdrawalMethod" NOT NULL,
    "amountUsd" DECIMAL(20,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stablecoinNetwork" TEXT,
    "destinationAddress" TEXT,
    "txHash" TEXT,
    "provider" TEXT,
    "providerPaymentId" TEXT,
    "providerCheckoutUrl" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformWithdrawal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformWithdrawal_txHash_key" ON "PlatformWithdrawal"("txHash") WHERE "txHash" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformWithdrawal_idempotencyKey_key" ON "PlatformWithdrawal"("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "PlatformWithdrawal_userId_idx" ON "PlatformWithdrawal"("userId");
CREATE INDEX IF NOT EXISTS "PlatformWithdrawal_investorId_idx" ON "PlatformWithdrawal"("investorId");
CREATE INDEX IF NOT EXISTS "PlatformWithdrawal_status_idx" ON "PlatformWithdrawal"("status");
CREATE INDEX IF NOT EXISTS "PlatformWithdrawal_method_idx" ON "PlatformWithdrawal"("method");
CREATE INDEX IF NOT EXISTS "PlatformWithdrawal_provider_providerPaymentId_idx" ON "PlatformWithdrawal"("provider", "providerPaymentId");

CREATE INDEX IF NOT EXISTS "PortfolioSnapshot_userId_idx" ON "PortfolioSnapshot"("userId");
CREATE INDEX IF NOT EXISTS "PortfolioSnapshot_investorId_idx" ON "PortfolioSnapshot"("investorId");
CREATE INDEX IF NOT EXISTS "PortfolioSnapshot_capturedAt_idx" ON "PortfolioSnapshot"("capturedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "PortfolioSnapshot_userId_capturedAt_key" ON "PortfolioSnapshot"("userId", "capturedAt");
