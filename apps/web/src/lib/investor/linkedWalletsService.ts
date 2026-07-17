import { prisma } from '@sanova/database';
import { normalizeLinkedWalletAddress } from './linkedWalletPolicy';
import { syncUserAccountStatus } from '../onboarding/syncUserAccount';

export type LinkedCryptoWalletDto = {
  id: string;
  address: string;
  network: string;
  provider: string;
  label: string | null;
  isDefault: boolean;
  linkedAt: string;
  lastUsedAt: string | null;
};

function serializeLinkedWallet(row: {
  id: string;
  address: string;
  network: string;
  provider: string;
  label: string | null;
  isDefault: boolean;
  linkedAt: Date;
  lastUsedAt: Date | null;
}): LinkedCryptoWalletDto {
  return {
    id: row.id,
    address: row.address,
    network: row.network,
    provider: row.provider,
    label: row.label,
    isDefault: row.isDefault,
    linkedAt: row.linkedAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null
  };
}

/**
 * Records every wallet a user ever links (or reuses) as history, and keeps a
 * single `isDefault` row in sync with the "current" wallet on User/Investor.
 * Called from `linkUserWallet` right after it updates the primary pointer, so
 * it never blocks or overrides the existing KYC/uniqueness/whitelist checks.
 */
export async function recordLinkedCryptoWallet(input: {
  userId: string;
  address: string;
  provider: string;
  network?: string;
}): Promise<void> {
  const address = normalizeLinkedWalletAddress(input.address);
  const network = input.network ?? 'BASE';

  await prisma.$transaction([
    prisma.linkedCryptoWallet.updateMany({
      where: { userId: input.userId, network, isDefault: true, NOT: { address } },
      data: { isDefault: false }
    }),
    prisma.linkedCryptoWallet.upsert({
      where: { userId_network_address: { userId: input.userId, network, address } },
      update: { isDefault: true, provider: input.provider, lastUsedAt: new Date() },
      create: {
        userId: input.userId,
        address,
        network,
        provider: input.provider,
        isDefault: true,
        lastUsedAt: new Date()
      }
    })
  ]);
}

export async function listLinkedCryptoWallets(userId: string): Promise<LinkedCryptoWalletDto[]> {
  const rows = await prisma.linkedCryptoWallet.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { linkedAt: 'desc' }]
  });

  return rows.map(serializeLinkedWallet);
}

/** Ensures the requested withdrawal destination is a wallet this user actually verified ownership of. */
export async function assertLinkedCryptoWalletOwnership(userId: string, address: string): Promise<string> {
  const normalized = normalizeLinkedWalletAddress(address);
  const row = await prisma.linkedCryptoWallet.findFirst({
    where: { userId, address: normalized }
  });

  if (!row) {
    throw new Error('WALLET_NOT_LINKED_TO_ACCOUNT');
  }

  await prisma.linkedCryptoWallet.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() }
  });

  return normalized;
}

/**
 * Switches which previously-verified wallet is "the" active one for new
 * purchases/deposits (User.walletAddress / Investor.walletAddress). Safe
 * without a new signature: every row in LinkedCryptoWallet was the primary
 * wallet for this same user at some point, so the unique constraint on
 * walletAddress can never conflict with another account.
 */
export async function setDefaultLinkedCryptoWallet(userId: string, address: string): Promise<void> {
  const normalized = await assertLinkedCryptoWalletOwnership(userId, address);

  await prisma.$transaction([
    prisma.linkedCryptoWallet.updateMany({
      where: { userId, network: 'BASE', NOT: { address: normalized } },
      data: { isDefault: false }
    }),
    prisma.linkedCryptoWallet.updateMany({
      where: { userId, network: 'BASE', address: normalized },
      data: { isDefault: true }
    }),
    prisma.user.updateMany({
      where: { id: userId },
      data: { walletAddress: normalized }
    }),
    prisma.investor.updateMany({
      where: { user: { id: userId } },
      data: { walletAddress: normalized }
    })
  ]);

  await syncUserAccountStatus(userId);
}
