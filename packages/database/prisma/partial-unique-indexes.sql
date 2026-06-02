-- Partial unique indexes for nullable payment identifiers.
-- Prisma schema cannot express partial uniques; enforce them in SQL.
-- Safe to re-run (IF NOT EXISTS).

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentIntent_txHash_key"
  ON "PaymentIntent" ("txHash")
  WHERE ("txHash" IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentIntent_idempotencyKey_key"
  ON "PaymentIntent" ("idempotencyKey")
  WHERE ("idempotencyKey" IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformDeposit_txHash_key"
  ON "PlatformDeposit" ("txHash")
  WHERE ("txHash" IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformDeposit_idempotencyKey_key"
  ON "PlatformDeposit" ("idempotencyKey")
  WHERE ("idempotencyKey" IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformWithdrawal_txHash_key"
  ON "PlatformWithdrawal" ("txHash")
  WHERE ("txHash" IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformWithdrawal_idempotencyKey_key"
  ON "PlatformWithdrawal" ("idempotencyKey")
  WHERE ("idempotencyKey" IS NOT NULL);
