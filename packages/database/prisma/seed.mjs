import { PrismaClient } from '@prisma/client';
import {
  LEGACY_MARKETPLACE_PROJECT_IDS,
  MARKETPLACE_SEED_LISTINGS
} from './marketplace-seed-listings.mjs';

const prisma = new PrismaClient();

async function main() {
  for (const listing of MARKETPLACE_SEED_LISTINGS) {
    const { fiscalRegime, equitySharePercent, maturityDate, tokenInstrumentType, ...rest } = listing;

    await prisma.project.upsert({
      where: { id: listing.id },
      create: {
        ...rest,
        fiscalRegime,
        tokenInstrumentType,
        maturityDate: maturityDate ?? null,
        equitySharePercent: equitySharePercent ?? null,
        isActive: true
      },
      update: {
        ...rest,
        fiscalRegime,
        tokenInstrumentType,
        maturityDate: maturityDate ?? null,
        equitySharePercent: equitySharePercent ?? null,
        isActive: true
      }
    });
  }

  if (LEGACY_MARKETPLACE_PROJECT_IDS.length > 0) {
    await prisma.project.updateMany({
      where: { id: { in: LEGACY_MARKETPLACE_PROJECT_IDS } },
      data: { isActive: false }
    });
  }

  console.log(`[seed] Upserted ${MARKETPLACE_SEED_LISTINGS.length} marketplace projects.`);
}

main()
  .catch((error) => {
    console.error('[seed] Failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
