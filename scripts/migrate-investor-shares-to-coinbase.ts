#!/usr/bin/env node
/**
 * Transfiere shares del vault desde treasury Safe hacia la wallet Coinbase del admin/inversor.
 *
 * Uso:
 *   npx tsx scripts/migrate-investor-shares-to-coinbase.ts <projectId> [recipientWallet]
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../packages/database/.env') });
config({ path: resolve(__dirname, '../.env') });
if (process.env.DIRECT_URL?.trim()) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { PrismaClient } from '@prisma/client';
import { getAdminAsset } from '../apps/web/src/lib/admin/assetsService';
import { migrateTreasuryVaultSharesToWallet } from '../apps/web/src/lib/blockchain/migrateTreasuryVaultShares';

const prisma = new PrismaClient();

async function main() {
  const projectId = process.argv[2] ?? 'proj-apart-hotel-urban-view-anelo-mplonxbv';
  const explicitRecipient = process.argv[3]?.trim();

  const admin = await prisma.user.findFirst({
    where: { systemRole: 'ADMIN' },
    select: { id: true, email: true, walletAddress: true, investorId: true }
  });

  const recipient = explicitRecipient || admin?.walletAddress?.trim();
  if (!recipient) {
    throw new Error('Sin wallet destino. Pasá la dirección Coinbase o vinculá wallet en el perfil admin.');
  }

  const asset = await getAdminAsset(projectId);
  if (!asset) throw new Error(`Asset not found: ${projectId}`);

  let shareAmount: bigint | undefined;
  if (admin?.investorId) {
    const investment = await prisma.investment.findFirst({
      where: { investorId: admin.investorId, projectId, status: 'ACTIVE' },
      select: { tokenCount: true }
    });
    if (investment?.tokenCount) {
      shareAmount = BigInt(investment.tokenCount) * 10n ** 18n;
      console.log(`[migrate] tokens en portfolio: ${investment.tokenCount}`);
    }
  }

  const result = await migrateTreasuryVaultSharesToWallet({
    asset,
    recipientWallet: recipient,
    shareAmount
  });

  if (!result.ok) {
    console.error(result);
    process.exit(1);
  }

  if (admin?.investorId) {
    await prisma.investor.update({
      where: { id: admin.investorId },
      data: { walletAddress: recipient.toLowerCase() }
    });
    await prisma.user.update({
      where: { id: admin.id },
      data: { walletAddress: recipient.toLowerCase() }
    });
  }

  console.log('[migrate] OK', result);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
