import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../packages/database/.env') });
config({ path: resolve(__dirname, '../.env') });
if (process.env.DIRECT_URL?.trim()) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Sepolia testnet duplicates of Urban View — hide from marketplace. */
const DEACTIVATE_IDS = [
  'proj-apart-hotel-urban-view-anelo',
  'proj-apart-hotel-urban-view'
];

const KEEP_ACTIVE_ID = 'proj-apart-hotel-urban-view-anelo-mplonxbv';

async function main() {
  console.log('=== D — Deactivate Sepolia duplicate listings ===\n');

  for (const id of DEACTIVATE_IDS) {
    const before = await prisma.project.findUnique({
      where: { id },
      select: { id: true, title: true, chainId: true, isActive: true }
    });

    if (!before) {
      console.log(`skip ${id} (not found)`);
      continue;
    }

    if (before.id === KEEP_ACTIVE_ID) {
      console.log(`skip ${id} (mainnet canonical asset)`);
      continue;
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { isActive: false }
    });

    console.log(`deactivated ${updated.id}`, {
      title: updated.title,
      chainId: before.chainId,
      wasActive: before.isActive
    });
  }

  const mainnet = await prisma.project.findUnique({
    where: { id: KEEP_ACTIVE_ID },
    select: { id: true, title: true, chainId: true, isActive: true }
  });

  console.log('\nMainnet asset (must stay active):', mainnet);

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
