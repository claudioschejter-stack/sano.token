import { prisma } from '@sanova/database';
import { getLinkedWalletForUser } from '../investor/linkedWalletPolicy';
import { archivePrivyWallet, walletIdForAddress } from './walletArchiveApi';
import {
  listPrivyEthereumWalletAddressesForInvestor,
  lookupPrivyUserByCustomAuthId,
  lookupPrivyUserByEmail
} from './privyWalletProvisioning';
import type { PrivyUserRecord } from './privyUserApi';

export type ArchiveDuplicateWalletsResult = {
  userId: string;
  keptAddress: string | null;
  archived: Array<{ address: string; walletId: string }>;
  failed: Array<{ address: string; walletId: string | null; error: string }>;
};

/**
 * Archive every Privy ethereum wallet for an investor except the linked one.
 * Never archives the wallet Sanova pays from, and never archives funded wallets
 * (safety: only zero-balance forks should be retired).
 */
export async function archiveDuplicateInvestorWallets(input: {
  userId: string;
  /** Balances by lowercase address; addresses with funds are skipped. */
  balanceByAddress?: Record<string, number>;
}): Promise<ArchiveDuplicateWalletsResult> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true }
  });

  const keptAddress = await getLinkedWalletForUser(input.userId);
  const all = await listPrivyEthereumWalletAddressesForInvestor({
    userId: input.userId,
    email: user?.email
  });

  const privyUsers: PrivyUserRecord[] = [];
  if (user?.email) {
    const emailUser = await lookupPrivyUserByEmail(user.email).catch(() => null);
    if (emailUser) privyUsers.push(emailUser);
  }
  const customUser = await lookupPrivyUserByCustomAuthId(input.userId).catch(() => null);
  if (customUser) privyUsers.push(customUser);

  const archived: ArchiveDuplicateWalletsResult['archived'] = [];
  const failed: ArchiveDuplicateWalletsResult['failed'] = [];

  for (const address of all) {
    if (!keptAddress || address === keptAddress) continue;

    const balance = input.balanceByAddress?.[address];
    if (typeof balance === 'number' && balance > 1e-9) {
      failed.push({ address, walletId: null, error: 'WALLET_HAS_FUNDS' });
      continue;
    }

    const walletId = walletIdForAddress(privyUsers, address);
    if (!walletId) {
      failed.push({ address, walletId: null, error: 'WALLET_ID_NOT_FOUND' });
      continue;
    }

    try {
      await archivePrivyWallet(walletId);
      archived.push({ address, walletId });
    } catch (error) {
      failed.push({
        address,
        walletId,
        error: error instanceof Error ? error.message : 'ARCHIVE_FAILED'
      });
    }
  }

  return { userId: input.userId, keptAddress, archived, failed };
}
