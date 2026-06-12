import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
config({ path: resolve(root, 'packages/database/.env') });
config({ path: resolve(root, '.env') });
if (process.env.DIRECT_URL?.trim()) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Legacy Urban View duplicate — Morpho NO_LIQUIDITY; canonical asset is mplonxbv. */
const LEGACY_DEACTIVATE_IDS = ['proj-anelo-apart-hotel-urban-view'];

const CANONICAL_ACTIVE_ID = 'proj-apart-hotel-urban-view-anelo-mplonxbv';

async function main() {
  console.log('=== Deactivate legacy Urban View duplicates ===\n');

  for (const id of LEGACY_DEACTIVATE_IDS) {
    const before = await prisma.project.findUnique({
      where: { id },
      select: { id: true, title: true, chainId: true, isActive: true }
    });

    if (!before) {
      console.log(`skip ${id} (not found)`);
      continue;
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { isActive: false }
    });

    console.log(`deactivated ${updated.id}`, {
      title: before.title,
      chainId: before.chainId,
      wasActive: before.isActive
    });
  }

  const canonical = await prisma.project.findUnique({
    where: { id: CANONICAL_ACTIVE_ID },
    select: { id: true, title: true, chainId: true, isActive: true }
  });

  console.log('\nCanonical mainnet asset:', canonical);

  const activeUrban = await prisma.project.findMany({
    where: {
      title: { contains: 'Urban View', mode: 'insensitive' },
      isActive: true
    },
    select: { id: true, title: true, chainId: true }
  });

  console.log('\nActive Urban View listings:', activeUrban);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
