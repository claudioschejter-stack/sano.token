import {
  buildPrivyAuthorizationSignature,
  isPrivyAuthorizationSigningConfigured
} from './privyAuthorizationSignature';
import { privyApiBase, privyHeaders } from './privyHttp';
import type { PrivyLinkedAccount, PrivyUserRecord } from './privyUserApi';

/**
 * Archive (reversible soft-delete) a Privy wallet so it can no longer sign or
 * be used, without touching its on-chain address.
 *
 * @see https://docs.privy.io/wallets/wallets/archive-a-wallet
 */
export async function archivePrivyWallet(walletId: string): Promise<void> {
  const id = walletId.trim();
  if (!id) {
    throw new Error('PRIVY_WALLET_ID_REQUIRED');
  }

  const url = `${privyApiBase()}/v1/wallets/${id}/archive`;
  const body: Record<string, unknown> = {};

  const extraHeaders: Record<string, string> = {};
  if (isPrivyAuthorizationSigningConfigured()) {
    extraHeaders['privy-authorization-signature'] = buildPrivyAuthorizationSignature({
      url,
      body
    });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: privyHeaders(extraHeaders),
    body: JSON.stringify(body)
  });

  if (response.status === 404) {
    // Already archived or unknown — treat as done.
    return;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PRIVY_WALLET_ARCHIVE_FAILED:${response.status}:${text.slice(0, 300)}`);
  }
}

/** Ethereum embedded wallets with their Privy wallet ids (needed to archive). */
export function listEthereumWalletsWithIds(
  linkedAccounts: PrivyLinkedAccount[] = []
): Array<{ id: string; address: string }> {
  const rows: Array<{ id: string; address: string }> = [];
  for (const account of linkedAccounts) {
    if (account.type !== 'wallet' || !account.address || !account.id) continue;
    if (account.chain_type && account.chain_type !== 'ethereum') continue;
    rows.push({ id: account.id.trim(), address: account.address.trim().toLowerCase() });
  }
  return rows;
}

export function walletIdForAddress(
  users: PrivyUserRecord[],
  address: string
): string | null {
  const target = address.trim().toLowerCase();
  for (const user of users) {
    const match = listEthereumWalletsWithIds(user.linked_accounts).find(
      (row) => row.address === target
    );
    if (match) return match.id;
  }
  return null;
}
