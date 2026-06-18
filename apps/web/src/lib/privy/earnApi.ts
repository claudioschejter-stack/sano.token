import {
  isPrivyEarnConfigured,
  privyAppId,
  privyTreasuryWalletId,
  privyVaultId
} from './config';

const PRIVY_API = 'https://api.privy.io';

function privyAuthHeader(): string {
  const secret = process.env.PRIVY_APP_SECRET?.trim();
  if (!secret) {
    throw new Error('PRIVY_APP_SECRET_NOT_CONFIGURED');
  }
  const credentials = Buffer.from(`${privyAppId()}:${secret}`).toString('base64');
  return `Basic ${credentials}`;
}

function privyHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    'privy-app-id': privyAppId(),
    Authorization: privyAuthHeader(),
    'Content-Type': 'application/json',
    ...extra
  };
}

export type PrivyEarnAmountInput =
  | { amount: string; raw_amount?: never }
  | { raw_amount: string; amount?: never };

/** GET /v1/earn/ethereum/vaults/{vault_id} — verify vault is live. */
export async function getPrivyVaultDetails() {
  if (!isPrivyEarnConfigured()) {
    throw new Error('PRIVY_EARN_NOT_CONFIGURED');
  }

  const vaultId = privyVaultId();
  const response = await fetch(`${PRIVY_API}/api/v1/earn/ethereum/vaults/${vaultId}`, {
    headers: privyHeaders()
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PRIVY_VAULT_DETAILS_FAILED:${response.status}:${body}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

/** POST deposit USDC from treasury wallet into Privy Earn vault. */
export async function depositToPrivyVault(
  input: PrivyEarnAmountInput & { walletId?: string; idempotencyKey?: string }
) {
  if (!isPrivyEarnConfigured()) {
    throw new Error('PRIVY_EARN_NOT_CONFIGURED');
  }

  const walletId = input.walletId?.trim() || privyTreasuryWalletId();
  if (!walletId) {
    throw new Error('PRIVY_TREASURY_WALLET_ID_NOT_CONFIGURED');
  }

  const body: Record<string, string> = {
    vault_id: privyVaultId(),
    ...(input.amount ? { amount: input.amount } : { raw_amount: input.raw_amount! })
  };

  const response = await fetch(
    `${PRIVY_API}/api/v1/wallets/${walletId}/earn/ethereum/deposit`,
    {
      method: 'POST',
      headers: privyHeaders(
        input.idempotencyKey ? { 'privy-idempotency-key': input.idempotencyKey } : undefined
      ),
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PRIVY_EARN_DEPOSIT_FAILED:${response.status}:${text}`);
  }

  return response.json() as Promise<{
    id: string;
    status: string;
    vault_id: string;
    vault_address?: string;
    transaction_hash?: string | null;
  }>;
}

/** POST withdraw USDC (+ yield) from Privy Earn vault back to treasury wallet. */
export async function withdrawFromPrivyVault(
  input: PrivyEarnAmountInput & { walletId?: string; idempotencyKey?: string }
) {
  if (!isPrivyEarnConfigured()) {
    throw new Error('PRIVY_EARN_NOT_CONFIGURED');
  }

  const walletId = input.walletId?.trim() || privyTreasuryWalletId();
  if (!walletId) {
    throw new Error('PRIVY_TREASURY_WALLET_ID_NOT_CONFIGURED');
  }

  const body: Record<string, string> = {
    vault_id: privyVaultId(),
    ...(input.amount ? { amount: input.amount } : { raw_amount: input.raw_amount! })
  };

  const response = await fetch(
    `${PRIVY_API}/api/v1/wallets/${walletId}/earn/ethereum/withdraw`,
    {
      method: 'POST',
      headers: privyHeaders(
        input.idempotencyKey ? { 'privy-idempotency-key': input.idempotencyKey } : undefined
      ),
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PRIVY_EARN_WITHDRAW_FAILED:${response.status}:${text}`);
  }

  return response.json() as Promise<{
    id: string;
    status: string;
    vault_id: string;
    amount?: string;
    raw_amount?: string;
  }>;
}
