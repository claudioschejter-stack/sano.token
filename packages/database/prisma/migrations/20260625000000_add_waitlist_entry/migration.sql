-- CreateTable
CREATE TABLE IF NOT EXISTS "WaitlistEntry" (
    "id"        TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WaitlistEntry_email_projectId_key" ON "WaitlistEntry"("email", "projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WaitlistEntry_projectId_createdAt_idx" ON "WaitlistEntry"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WaitlistEntry_email_idx" ON "WaitlistEntry"("email");
