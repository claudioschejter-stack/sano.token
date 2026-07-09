import { normalizeEmail } from '../auth/contactValidation';
import { isPrivyEnabled } from './config';
import { privyApiBase, privyHeaders } from './privyHttp';
import type { PrivyLinkedAccount, PrivyUserRecord } from './privyUserApi';

/**
 * Server-side embedded wallet provisioning (Privy REST API).
 *
 * Root cause of investors staying stuck on "Necesita wallet": the embedded
 * Privy wallet was only ever created client-side, when the user reached and
 * stayed on the "Configurá pagos" onboarding step. If they approved KYC
 * (async, via the Didit webhook) and never came back to that step, no
 * wallet was ever created. This pre-generates the wallet server-side, by
 * email, the moment KYC is approved — no client interaction required.
 * When the user eventually opens the "Configurá pagos" step (or the Privy
 * SDK initializes for any other reason), `createOnLogin: 'users-without-
 * wallets'` finds this same email already has a wallet and simply links it
 * to the session instead of creating a second one.
 */

function findEthereumEmbeddedWalletAddress(linkedAccounts: PrivyLinkedAccount[] = []): string | null {
  for (const account of linkedAccounts) {
    if (account.type !== 'wallet' || !account.address) {
      continue;
    }
    if (account.chain_type && account.chain_type !== 'ethereum') {
      continue;
    }
    return account.address.trim().toLowerCase();
  }
  return null;
}

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

async function createWalletForExistingPrivyUser(privyUserId: string): Promise<string | null> {
  const response = await fetch(`${privyApiBase()}/v1/wallets`, {
    method: 'POST',
    headers: privyHeaders(),
    body: JSON.stringify({ owner: { user_id: privyUserId }, chain_type: 'ethereum' })
  });

  if (!response.ok) {
    throw new Error(`PRIVY_WALLET_CREATE_FAILED:${response.status}`);
  }

  const wallet = (await response.json()) as { address?: string };
  return wallet.address?.trim().toLowerCase() ?? null;
}

async function createPrivyUserWithWallet(email: string): Promise<PrivyUserRecord | null> {
  const response = await fetch(`${privyApiBase()}/v1/users`, {
    method: 'POST',
    headers: privyHeaders(),
    body: JSON.stringify({
      linked_accounts: [{ type: 'email', address: email }],
      wallets: [{ chain_type: 'ethereum' }]
    })
  });

  if (!response.ok) {
    // Most likely a race against a concurrent client-side Privy login that
    // just created the same user — the caller falls back to a fresh lookup.
    return null;
  }

  return (await response.json()) as PrivyUserRecord;
}

/**
 * Returns a real (non-placeholder) Ethereum wallet address for the given
 * email, creating the Privy user and/or wallet server-side if needed.
 * Returns null (never throws) on any failure — callers must treat this as
 * best-effort and keep the existing client-driven wallet step as a fallback.
 */
export async function pregenerateOrFetchPrivyWallet(rawEmail: string): Promise<string | null> {
  if (!isPrivyEnabled()) {
    return null;
  }

  const email = normalizeEmail(rawEmail);
  if (!email) {
    return null;
  }

  try {
    const existingUser = await lookupPrivyUserByEmail(email);
    if (existingUser) {
      const existingWallet = findEthereumEmbeddedWalletAddress(existingUser.linked_accounts);
      return existingWallet ?? (await createWalletForExistingPrivyUser(existingUser.id));
    }

    const createdUser = await createPrivyUserWithWallet(email);
    if (createdUser) {
      return findEthereumEmbeddedWalletAddress(createdUser.linked_accounts);
    }

    const retryUser = await lookupPrivyUserByEmail(email);
    if (!retryUser) {
      return null;
    }

    const retryWallet = findEthereumEmbeddedWalletAddress(retryUser.linked_accounts);
    return retryWallet ?? (await createWalletForExistingPrivyUser(retryUser.id));
  } catch (error) {
    console.error('[privyWalletProvisioning] pregenerateOrFetchPrivyWallet failed', error);
    return null;
  }
}
