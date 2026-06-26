-- AddColumn User.totpSecret
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpSecret" TEXT;
-- AddColumn User.totpEnabled
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
-- AddColumn User.failed2faAttempts
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failed2faAttempts" INTEGER NOT NULL DEFAULT 0;
-- AddColumn User.locked2faUntil
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "locked2faUntil" TIMESTAMP(3);

-- CreateTable BackupCode
CREATE TABLE IF NOT EXISTS "BackupCode" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "codeHash"  TEXT NOT NULL,
    "usedAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BackupCode_userId_idx" ON "BackupCode"("userId");

-- AddForeignKey
ALTER TABLE "BackupCode" ADD CONSTRAINT "BackupCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
