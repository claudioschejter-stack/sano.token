import { normalizeEmail } from '../auth/contactValidation';
import { isPrivyEnabled } from './config';
import { privyAuthorizationKeyQuorumId } from './privyAuthorizationSignature';
import { privyApiBase, privyHeaders } from './privyHttp';
import type { PrivyLinkedAccount, PrivyUserRecord } from './privyUserApi';

/**
 * Server-side embedded wallet provisioning (Privy REST API).
 *
 * Identity rule (Phase 1):
 * - Canonical Privy user is keyed by Custom Auth `custom_user_id` = Sanova `user.id`
 *   (same `sub` issued by `/api/auth/privy-token`).
 * - Email is linked on that same Privy user when possible.
 * - Wallets are created with the app authorization key as `additional_signers`
 *   so server settle can spend without Coinbase / WalletConnect.
 *
 * Legacy: older email-only Privy users may still hold funded wallets. We keep
 * those addresses as receive targets when they hold USDC, and resolve wallet
 * ids from either identity until ops grants the authorization signer.
 */

/** Attach app authorization key so server auto-settle works without a browser Privy session. */
function additionalSignersPayload(): Array<{ signer_id: string }> | undefined {
  const signerId = privyAuthorizationKeyQuorumId();
  return signerId ? [{ signer_id: signerId }] : undefined;
}

function isEthereumWalletAccount(account: PrivyLinkedAccount): boolean {
  if (account.type !== 'wallet' || !account.address?.trim()) {
    return false;
  }
  if (account.chain_type && account.chain_type !== 'ethereum') {
    return false;
  }
  return true;
}

function findEthereumEmbeddedWalletAddress(linkedAccounts: PrivyLinkedAccount[] = []): string | null {
  const wallets = listEthereumWalletAddresses(linkedAccounts);
  return wallets[0] ?? null;
}

/** All ethereum wallet addresses on a Privy user (embedded first). */
export function listEthereumWalletAddresses(linkedAccounts: PrivyLinkedAccount[] = []): string[] {
  const embedded: string[] = [];
  const other: string[] = [];

  for (const account of linkedAccounts) {
    if (!isEthereumWalletAccount(account)) {
      continue;
    }
    const address = account.address!.trim().toLowerCase();
    const isEmbedded =
      account.wallet_client_type === 'privy' ||
      account.connector_type === 'embedded' ||
      !account.wallet_client_type;
    if (isEmbedded) {
      embedded.push(address);
    } else {
      other.push(address);
    }
  }

  return [...new Set([...embedded, ...other])];
}

export async function lookupPrivyUserByEmail(email: string): Promise<PrivyUserRecord | null> {
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

export async function lookupPrivyUserByCustomAuthId(
  customUserId: string
): Promise<PrivyUserRecord | null> {
  const response = await fetch(`${privyApiBase()}/v1/users/custom_auth/id`, {
    method: 'POST',
    headers: privyHeaders(),
    body: JSON.stringify({ custom_user_id: customUserId }),
    cache: 'no-store'
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`PRIVY_CUSTOM_AUTH_LOOKUP_FAILED:${response.status}`);
  }

  return (await response.json()) as PrivyUserRecord;
}

/** Lookup every ethereum wallet Privy has for this email (no create). */
export async function listPrivyEthereumWalletAddressesForEmail(rawEmail: string): Promise<string[]> {
  if (!isPrivyEnabled()) {
    return [];
  }

  const email = normalizeEmail(rawEmail);
  if (!email) {
    return [];
  }

  try {
    const existingUser = await lookupPrivyUserByEmail(email);
    if (!existingUser) {
      return [];
    }
    return listEthereumWalletAddresses(existingUser.linked_accounts);
  } catch (error) {
    console.error('[privyWalletProvisioning] listPrivyEthereumWalletAddressesForEmail failed', error);
    return [];
  }
}

/** Wallets for Custom Auth identity (Sanova user.id) + legacy email identity. */
export async function listPrivyEthereumWalletAddressesForInvestor(input: {
  userId: string;
  email?: string | null;
}): Promise<string[]> {
  if (!isPrivyEnabled()) {
    return [];
  }

  const addresses: string[] = [];
  try {
    const customUser = await lookupPrivyUserByCustomAuthId(input.userId);
    if (customUser) {
      addresses.push(...listEthereumWalletAddresses(customUser.linked_accounts));
    }
  } catch (error) {
    console.error('[privyWalletProvisioning] custom_auth wallet list failed', error);
  }

  const email = normalizeEmail(input.email ?? '');
  if (email) {
    try {
      const emailUser = await lookupPrivyUserByEmail(email);
      if (emailUser) {
        addresses.push(...listEthereumWalletAddresses(emailUser.linked_accounts));
      }
    } catch (error) {
      console.error('[privyWalletProvisioning] email wallet list failed', error);
    }
  }

  return [...new Set(addresses)];
}

async function createWalletForExistingPrivyUser(privyUserId: string): Promise<string | null> {
  const additional_signers = additionalSignersPayload();
  const response = await fetch(`${privyApiBase()}/v1/wallets`, {
    method: 'POST',
    headers: privyHeaders(),
    body: JSON.stringify({
      owner: { user_id: privyUserId },
      chain_type: 'ethereum',
      ...(additional_signers ? { additional_signers } : {})
    })
  });

  if (!response.ok) {
    throw new Error(`PRIVY_WALLET_CREATE_FAILED:${response.status}`);
  }

  const wallet = (await response.json()) as { address?: string };
  return wallet.address?.trim().toLowerCase() ?? null;
}

async function ensureWalletAddressOnPrivyUser(user: PrivyUserRecord): Promise<string | null> {
  const existing = findEthereumEmbeddedWalletAddress(user.linked_accounts);
  if (existing) {
    return existing;
  }
  return createWalletForExistingPrivyUser(user.id);
}

async function createUnifiedPrivyUser(input: {
  userId: string;
  email: string;
}): Promise<PrivyUserRecord | null> {
  const additional_signers = additionalSignersPayload();
  const response = await fetch(`${privyApiBase()}/v1/users`, {
    method: 'POST',
    headers: privyHeaders(),
    body: JSON.stringify({
      linked_accounts: [
        { type: 'custom_auth', custom_user_id: input.userId },
        { type: 'email', address: input.email }
      ],
      wallets: [
        {
          chain_type: 'ethereum',
          ...(additional_signers ? { additional_signers } : {})
        }
      ]
    })
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as PrivyUserRecord;
}

async function createCustomAuthPrivyUserWithWallet(userId: string): Promise<PrivyUserRecord | null> {
  const additional_signers = additionalSignersPayload();
  const response = await fetch(`${privyApiBase()}/v1/users`, {
    method: 'POST',
    headers: privyHeaders(),
    body: JSON.stringify({
      linked_accounts: [{ type: 'custom_auth', custom_user_id: userId }],
      wallets: [
        {
          chain_type: 'ethereum',
          ...(additional_signers ? { additional_signers } : {})
        }
      ]
    })
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as PrivyUserRecord;
}

/** @deprecated Prefer ensureSanovaPrivyWallet — email-only create path kept for legacy callers. */
async function createPrivyUserWithWallet(email: string): Promise<PrivyUserRecord | null> {
  const additional_signers = additionalSignersPayload();
  const response = await fetch(`${privyApiBase()}/v1/users`, {
    method: 'POST',
    headers: privyHeaders(),
    body: JSON.stringify({
      linked_accounts: [{ type: 'email', address: email }],
      wallets: [
        {
          chain_type: 'ethereum',
          ...(additional_signers ? { additional_signers } : {})
        }
      ]
    })
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as PrivyUserRecord;
}

export type SanovaPrivyWalletResult = {
  address: string;
  privyUserId: string;
  /** true when wallet lives on Custom Auth identity (matches JWT sub). */
  unifiedIdentity: boolean;
};

/**
 * Ensure the investor has a Privy embedded wallet aligned with Custom Auth.
 * Never throws — returns null on failure.
 */
export async function ensureSanovaPrivyWallet(input: {
  userId: string;
  email: string;
}): Promise<SanovaPrivyWalletResult | null> {
  if (!isPrivyEnabled()) {
    return null;
  }

  const email = normalizeEmail(input.email);
  if (!input.userId.trim() || !email) {
    return null;
  }

  try {
    let customUser = await lookupPrivyUserByCustomAuthId(input.userId);
    let emailUser = await lookupPrivyUserByEmail(email);

    // Neither exists → create unified user (custom_auth + email + signed wallet).
    if (!customUser && !emailUser) {
      const created = await createUnifiedPrivyUser({ userId: input.userId, email });
      if (created) {
        const address = findEthereumEmbeddedWalletAddress(created.linked_accounts);
        if (address) {
          return { address, privyUserId: created.id, unifiedIdentity: true };
        }
      }
      // Race: someone else created mid-flight.
      customUser = await lookupPrivyUserByCustomAuthId(input.userId);
      emailUser = await lookupPrivyUserByEmail(email);
    }

    // Same Privy user already has both identities (ideal).
    if (customUser && emailUser && customUser.id === emailUser.id) {
      const address = await ensureWalletAddressOnPrivyUser(customUser);
      if (!address) return null;
      return { address, privyUserId: customUser.id, unifiedIdentity: true };
    }

    // Custom Auth user exists (session-aligned). Prefer it for new signing path.
    if (customUser) {
      const address = await ensureWalletAddressOnPrivyUser(customUser);
      if (!address) return null;
      return { address, privyUserId: customUser.id, unifiedIdentity: true };
    }

    // Legacy email-only Privy user: keep their wallet, and also create a
    // Custom Auth identity with a signed wallet so future Custom Auth sessions
    // have a home. Callers that pick canonical by USDC balance will keep the
    // funded legacy address until ops grants the authorization signer.
    if (emailUser) {
      const legacyAddress =
        findEthereumEmbeddedWalletAddress(emailUser.linked_accounts) ??
        (await createWalletForExistingPrivyUser(emailUser.id));

      const createdCustom = await createCustomAuthPrivyUserWithWallet(input.userId);
      if (createdCustom) {
        const customAddress = findEthereumEmbeddedWalletAddress(createdCustom.linked_accounts);
        // If legacy has no wallet yet, use the new unified-capable wallet.
        if (!legacyAddress && customAddress) {
          return {
            address: customAddress,
            privyUserId: createdCustom.id,
            unifiedIdentity: true
          };
        }
      }

      if (!legacyAddress) {
        return null;
      }
      return {
        address: legacyAddress,
        privyUserId: emailUser.id,
        unifiedIdentity: false
      };
    }

    // Last resort: custom_auth-only user.
    const createdCustom = await createCustomAuthPrivyUserWithWallet(input.userId);
    if (!createdCustom) {
      return null;
    }
    const address = findEthereumEmbeddedWalletAddress(createdCustom.linked_accounts);
    if (!address) {
      return null;
    }
    return { address, privyUserId: createdCustom.id, unifiedIdentity: true };
  } catch (error) {
    console.error('[privyWalletProvisioning] ensureSanovaPrivyWallet failed', error);
    return null;
  }
}

/**
 * Returns a real (non-placeholder) Ethereum wallet address for the given
 * email, creating the Privy user and/or wallet server-side if needed.
 * @deprecated Prefer ensureSanovaPrivyWallet({ userId, email }).
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
