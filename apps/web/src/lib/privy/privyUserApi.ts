import { normalizeEmail } from '../auth/contactValidation';
import { privyAppId } from './config';

const PRIVY_API = 'https://api.privy.io';

function privyAuthHeader(): string {
  const secret = process.env.PRIVY_APP_SECRET?.trim();
  if (!secret) {
    throw new Error('PRIVY_APP_SECRET_NOT_CONFIGURED');
  }

  return `Basic ${Buffer.from(`${privyAppId()}:${secret}`).toString('base64')}`;
}

function privyHeaders(): HeadersInit {
  return {
    'privy-app-id': privyAppId(),
    Authorization: privyAuthHeader(),
    'Content-Type': 'application/json'
  };
}

type PrivyLinkedAccount = {
  id?: string | null;
  type?: string;
  address?: string;
  email?: string;
  chain_type?: string;
  connector_type?: string;
  wallet_client_type?: string;
  verified_at?: number | null;
  latest_verified_at?: number | null;
  first_verified_at?: number | null;
};

export type PrivyUserRecord = {
  id: string;
  linked_accounts: PrivyLinkedAccount[];
};

export async function fetchPrivyUser(userId: string): Promise<PrivyUserRecord> {
  const response = await fetch(`${PRIVY_API}/v1/users/${encodeURIComponent(userId)}`, {
    headers: privyHeaders(),
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error('PRIVY_USER_LOOKUP_FAILED');
  }

  return (await response.json()) as PrivyUserRecord;
}

function isVerifiedLinkedAccount(account: PrivyLinkedAccount): boolean {
  return Boolean(account.verified_at ?? account.latest_verified_at ?? account.first_verified_at);
}

export function extractVerifiedPrivyEmails(linkedAccounts: PrivyLinkedAccount[]): string[] {
  const emails = new Set<string>();

  for (const account of linkedAccounts) {
    if (!isVerifiedLinkedAccount(account)) {
      continue;
    }

    if (account.type === 'email' && account.address) {
      const normalized = normalizeEmail(account.address);
      if (normalized) {
        emails.add(normalized);
      }
      continue;
    }

    if (account.email) {
      const normalized = normalizeEmail(account.email);
      if (normalized) {
        emails.add(normalized);
      }
    }
  }

  return [...emails];
}

/** Privy embedded wallet ID for Earn API calls (linked_accounts[].id). */
export function resolvePrivyEmbeddedWalletId(
  linkedAccounts: PrivyLinkedAccount[],
  walletAddress: string
): string | null {
  const normalized = walletAddress.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  for (const account of linkedAccounts) {
    if (account.type !== 'wallet') {
      continue;
    }
    if (account.connector_type !== 'embedded' && account.wallet_client_type !== 'privy') {
      continue;
    }
    if (account.chain_type && account.chain_type !== 'ethereum') {
      continue;
    }
    if (!account.address || account.address.toLowerCase() !== normalized) {
      continue;
    }
    const walletId = account.id?.trim();
    if (walletId) {
      return walletId;
    }
  }

  return null;
}
