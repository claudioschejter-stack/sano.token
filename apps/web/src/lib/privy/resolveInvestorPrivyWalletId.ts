import { prisma } from '@sanova/database';
import { getLinkedWalletForUser } from '../investor/linkedWalletPolicy';
import {
  listPrivyEthereumWalletAddressesForInvestor,
  lookupPrivyUserByCustomAuthId,
  lookupPrivyUserByEmail
} from './privyWalletProvisioning';
import type { PrivyLinkedAccount, PrivyUserRecord } from './privyUserApi';
import { resolvePrivyEmbeddedWalletId } from './privyUserApi';

function resolveWalletIdFromUser(
  privyUser: PrivyUserRecord,
  address: string
): string | null {
  const walletId = resolvePrivyEmbeddedWalletId(
    privyUser.linked_accounts as PrivyLinkedAccount[],
    address
  );
  if (walletId) {
    return walletId;
  }

  for (const account of privyUser.linked_accounts ?? []) {
    if (account.type !== 'wallet' || !account.address || !account.id) continue;
    if (account.address.trim().toLowerCase() !== address) continue;
    if (account.chain_type && account.chain_type !== 'ethereum') continue;
    return account.id.trim();
  }

  return null;
}

/**
 * Resolves the Privy wallet ID for the investor's canonical linked address.
 * Needed for server-side Transfer API settle.
 *
 * Prefers the email (registration) Privy identity — the original Sanova wallet —
 * then Custom Auth. Never invents a new wallet id.
 */
export async function resolveInvestorPrivyWalletIdForUser(userId: string): Promise<{
  address: string;
  walletId: string;
} | null> {
  const address = await getLinkedWalletForUser(userId);
  if (!address) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  });

  if (user?.email) {
    try {
      const emailUser = await lookupPrivyUserByEmail(user.email);
      if (emailUser) {
        const walletId = resolveWalletIdFromUser(emailUser, address);
        if (walletId) {
          return { address, walletId };
        }
      }
    } catch (error) {
      console.error('[resolveInvestorPrivyWalletId] email lookup failed', error);
    }
  }

  try {
    const customUser = await lookupPrivyUserByCustomAuthId(userId);
    if (customUser) {
      const walletId = resolveWalletIdFromUser(customUser, address);
      if (walletId) {
        return { address, walletId };
      }
    }
  } catch (error) {
    console.error('[resolveInvestorPrivyWalletId] custom_auth lookup failed', error);
  }

  // Address may still be a known Privy wallet, but without a resolvable wallet id
  // we must not guess — pay path returns PRIVY_WALLET_ID_NOT_FOUND.
  const wallets = await listPrivyEthereumWalletAddressesForInvestor({
    userId,
    email: user?.email
  });
  if (!wallets.includes(address)) {
    return null;
  }

  return null;
}
