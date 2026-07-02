-- CreateTable UserPasskey
CREATE TABLE IF NOT EXISTS "UserPasskey" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey"    BYTEA NOT NULL,
    "counter"      BIGINT NOT NULL DEFAULT 0,
    "deviceName"   TEXT,
    "transports"   JSONB,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt"   TIMESTAMP(3),

    CONSTRAINT "UserPasskey_pkey" PRIMARY KEY ("id")
);

-- CreateTable WebAuthnChallenge
CREATE TABLE IF NOT EXISTS "WebAuthnChallenge" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT,
    "email"     TEXT,
    "challenge" TEXT NOT NULL,
    "type"      TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebAuthnChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserPasskey_credentialId_key" ON "UserPasskey"("credentialId");
CREATE INDEX IF NOT EXISTS "UserPasskey_userId_idx" ON "UserPasskey"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "WebAuthnChallenge_challenge_key" ON "WebAuthnChallenge"("challenge");
CREATE INDEX IF NOT EXISTS "WebAuthnChallenge_expiresAt_idx" ON "WebAuthnChallenge"("expiresAt");
CREATE INDEX IF NOT EXISTS "WebAuthnChallenge_userId_idx" ON "WebAuthnChallenge"("userId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserPasskey_userId_fkey'
  ) THEN
    ALTER TABLE "UserPasskey" ADD CONSTRAINT "UserPasskey_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
