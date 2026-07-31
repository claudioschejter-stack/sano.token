import { prisma } from '@sanova/database';
import { getLinkedWalletForUser } from '../investor/linkedWalletPolicy';
import { listPrivyEthereumWalletAddressesForEmail } from './privyWalletProvisioning';
import { privyApiBase, privyHeaders } from './privyHttp';
import type { PrivyLinkedAccount, PrivyUserRecord } from './privyUserApi';
import { resolvePrivyEmbeddedWalletId } from './privyUserApi';

async function lookupPrivyUserByEmail(email: string): Promise<PrivyUserRecord | null> {
  const response = await fetch(`${privyApiBase()}/v1/users/email/address`, {
    method: 'POST',
    headers: privyHeaders(),
    body: JSON.stringify({ address: email }),
    cache: 'no-store'
  });

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`PRIVY_USER_LOOKUP_FAILED:${response.status}`);
  }
  return (await response.json()) as PrivyUserRecord;
}

/**
 * Resolves the Privy wallet ID for the investor's canonical linked address.
 * Needed for server-side eth_sendTransaction (auto-settle).
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
  if (!user?.email) {
    return null;
  }

  const privyUser = await lookupPrivyUserByEmail(user.email);
  if (!privyUser) {
    return null;
  }

  const walletId = resolvePrivyEmbeddedWalletId(privyUser.linked_accounts as PrivyLinkedAccount[], address);
  if (walletId) {
    return { address, walletId };
  }

  // Fallback: any ethereum wallet account matching the address (incl. server wallets).
  for (const account of privyUser.linked_accounts ?? []) {
    if (account.type !== 'wallet' || !account.address || !account.id) continue;
    if (account.address.trim().toLowerCase() !== address) continue;
    if (account.chain_type && account.chain_type !== 'ethereum') continue;
    return { address, walletId: account.id.trim() };
  }

  // Last resort: ensure address is still a Privy wallet for this email.
  const wallets = await listPrivyEthereumWalletAddressesForEmail(user.email);
  if (!wallets.includes(address)) {
    return null;
  }

  return null;
}
