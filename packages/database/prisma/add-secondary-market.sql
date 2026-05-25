-- Secondary market peer-to-peer listings
CREATE TYPE "SecondaryListingStatus" AS ENUM ('OPEN', 'FILLED', 'CANCELLED');

CREATE TABLE "SecondaryMarketListing" (
    "id" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "pricePerTokenUsd" DECIMAL(20,6) NOT NULL,
    "status" "SecondaryListingStatus" NOT NULL DEFAULT 'OPEN',
    "buyerUserId" TEXT,
    "txHash" TEXT,
    "filledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecondaryMarketListing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SecondaryMarketListing_projectId_status_idx" ON "SecondaryMarketListing"("projectId", "status");
CREATE INDEX "SecondaryMarketListing_sellerUserId_status_idx" ON "SecondaryMarketListing"("sellerUserId", "status");
CREATE INDEX "SecondaryMarketListing_status_createdAt_idx" ON "SecondaryMarketListing"("status", "createdAt");

ALTER TABLE "SecondaryMarketListing" ADD CONSTRAINT "SecondaryMarketListing_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecondaryMarketListing" ADD CONSTRAINT "SecondaryMarketListing_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecondaryMarketListing" ADD CONSTRAINT "SecondaryMarketListing_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
