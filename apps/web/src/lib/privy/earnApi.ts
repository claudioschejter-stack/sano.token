import { isPrivyEarnConfigured, privyTreasuryWalletId, privyVaultId } from './config';
import { privyApiBase, privyHeaders } from './privyHttp';

export type PrivyEarnAmountInput =
  | { amount: string; raw_amount?: never }
  | { raw_amount: string; amount?: never };

export type PrivyEarnDepositInput = PrivyEarnAmountInput & {
  walletId?: string;
  vaultId?: string;
  idempotencyKey?: string;
};

/** GET /v1/earn/ethereum/vaults/{vault_id} — verify vault is live. */
export async function getPrivyVaultDetails(vaultId?: string) {
  if (!isPrivyEarnConfigured()) {
    throw new Error('PRIVY_EARN_NOT_CONFIGURED');
  }

  const resolvedVaultId = vaultId?.trim() || privyVaultId();
  const response = await fetch(`${privyApiBase()}/api/v1/earn/ethereum/vaults/${resolvedVaultId}`, {
    headers: privyHeaders()
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PRIVY_VAULT_DETAILS_FAILED:${response.status}:${body}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

/** GET /v1/wallets/{wallet_id}/earn/ethereum/vaults?vault_id=… */
export async function getPrivyWalletEarnPosition(walletId: string, vaultId?: string) {
  if (!isPrivyEarnConfigured()) {
    throw new Error('PRIVY_EARN_NOT_CONFIGURED');
  }

  const resolvedVaultId = vaultId?.trim() || privyVaultId();
  const params = new URLSearchParams({ vault_id: resolvedVaultId });
  const response = await fetch(
    `${privyApiBase()}/api/v1/wallets/${walletId}/earn/ethereum/vaults?${params.toString()}`,
    { headers: privyHeaders() }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PRIVY_EARN_POSITION_FAILED:${response.status}:${body}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

/** GET /v1/wallets/{wallet_id}/actions/{action_id} */
export async function getPrivyVaultAction(
  walletId: string,
  actionId: string,
  includeSteps = false
) {
  const query = includeSteps ? '?include=steps' : '';
  const response = await fetch(
    `${privyApiBase()}/api/v1/wallets/${walletId}/actions/${actionId}${query}`,
    { headers: privyHeaders() }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PRIVY_WALLET_ACTION_FAILED:${response.status}:${body}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

/** POST deposit USDC from a Privy wallet into an Earn vault. */
export async function depositToPrivyVault(input: PrivyEarnDepositInput) {
  if (!isPrivyEarnConfigured()) {
    throw new Error('PRIVY_EARN_NOT_CONFIGURED');
  }

  const walletId = input.walletId?.trim() || privyTreasuryWalletId();
  if (!walletId) {
    throw new Error('PRIVY_WALLET_ID_NOT_CONFIGURED');
  }

  const vaultId = input.vaultId?.trim() || privyVaultId();
  if (!vaultId) {
    throw new Error('PRIVY_VAULT_ID_NOT_CONFIGURED');
  }

  const body: Record<string, string> = {
    vault_id: vaultId,
    ...(input.amount ? { amount: input.amount } : { raw_amount: input.raw_amount! })
  };

  const response = await fetch(
    `${privyApiBase()}/api/v1/wallets/${walletId}/earn/ethereum/deposit`,
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

/** POST withdraw USDC (+ yield) from Privy Earn vault back to a Privy wallet. */
export async function withdrawFromPrivyVault(
  input: PrivyEarnAmountInput & { walletId?: string; vaultId?: string; idempotencyKey?: string }
) {
  if (!isPrivyEarnConfigured()) {
    throw new Error('PRIVY_EARN_NOT_CONFIGURED');
  }

  const walletId = input.walletId?.trim() || privyTreasuryWalletId();
  if (!walletId) {
    throw new Error('PRIVY_TREASURY_WALLET_ID_NOT_CONFIGURED');
  }

  const vaultId = input.vaultId?.trim() || privyVaultId();
  if (!vaultId) {
    throw new Error('PRIVY_VAULT_ID_NOT_CONFIGURED');
  }

  const body: Record<string, string> = {
    vault_id: vaultId,
    ...(input.amount ? { amount: input.amount } : { raw_amount: input.raw_amount! })
  };

  const response = await fetch(
    `${privyApiBase()}/api/v1/wallets/${walletId}/earn/ethereum/withdraw`,
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
