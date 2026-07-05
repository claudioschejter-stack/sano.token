-- CreateTable RegistrationAttempt
CREATE TABLE IF NOT EXISTS "RegistrationAttempt" (
    "id"        TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "success"   BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "channel"   TEXT,
    "ipCountry" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RegistrationAttempt_email_idx" ON "RegistrationAttempt"("email");
CREATE INDEX IF NOT EXISTS "RegistrationAttempt_createdAt_idx" ON "RegistrationAttempt"("createdAt");
CREATE INDEX IF NOT EXISTS "RegistrationAttempt_success_createdAt_idx" ON "RegistrationAttempt"("success", "createdAt");
