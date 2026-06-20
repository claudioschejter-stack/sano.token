import {
  canUsePrivyEarnForVaultAddress,
  isPrivyEarnConfigured,
  privyVaultId,
  resolvePrivyEarnVaultId
} from './config';
import { depositToPrivyVault, getPrivyVaultAction, getPrivyWalletEarnPosition } from './earnApi';
import { fetchPrivyUser, resolvePrivyEmbeddedWalletId } from './privyUserApi';
import { verifyPrivyAccessToken } from './verifyAccessToken';
import type { VaultDepositLine } from '../web3/vaultDepositPayment';

export type InvestorEarnDepositResult = {
  actionId: string;
  walletId: string;
  vaultId: string;
  status: string;
  transactionHash: `0x${string}` | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resolveInvestorPrivyWalletId(input: {
  privyAccessToken: string;
  walletAddress: string;
}): Promise<{ privyUserId: string; walletId: string }> {
  const verified = await verifyPrivyAccessToken(input.privyAccessToken);
  const user = await fetchPrivyUser(verified.userId);
  const walletId = resolvePrivyEmbeddedWalletId(user.linked_accounts, input.walletAddress);

  if (!walletId) {
    throw new Error('PRIVY_WALLET_ID_NOT_FOUND');
  }

  return { privyUserId: verified.userId, walletId };
}

export async function waitForPrivyEarnAction(input: {
  walletId: string;
  actionId: string;
  timeoutMs?: number;
  pollMs?: number;
}): Promise<{ status: string; transactionHash: `0x${string}` | null }> {
  const timeoutMs = input.timeoutMs ?? 90_000;
  const pollMs = input.pollMs ?? 2_000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const action = await getPrivyVaultAction(input.walletId, input.actionId, true);
    const status = String(action.status ?? 'pending');

    if (status === 'succeeded') {
      const hash =
        typeof action.transaction_hash === 'string'
          ? (action.transaction_hash as `0x${string}`)
          : extractTransactionHashFromAction(action);
      return { status, transactionHash: hash };
    }

    if (status === 'rejected' || status === 'failed') {
      throw new Error(`PRIVY_EARN_DEPOSIT_${status.toUpperCase()}`);
    }

    await sleep(pollMs);
  }

  throw new Error('PRIVY_EARN_DEPOSIT_TIMEOUT');
}

function extractTransactionHashFromAction(action: Record<string, unknown>): `0x${string}` | null {
  const steps = action.steps;
  if (!Array.isArray(steps)) {
    return null;
  }

  for (const step of steps) {
    if (!step || typeof step !== 'object') {
      continue;
    }
    const hash =
      typeof (step as { transaction_hash?: string }).transaction_hash === 'string'
        ? (step as { transaction_hash: string }).transaction_hash
        : typeof (step as { hash?: string }).hash === 'string'
          ? (step as { hash: string }).hash
          : null;
    if (hash?.startsWith('0x')) {
      return hash as `0x${string}`;
    }
  }

  return null;
}

export function depositsEligibleForPrivyEarn(deposits: VaultDepositLine[]): boolean {
  if (!isPrivyEarnConfigured() || !deposits.length) {
    return false;
  }

  return deposits.every(
    (line) => line.amountUsd > 0 && line.vaultAddress?.trim() && canUsePrivyEarnForVaultAddress(line.vaultAddress)
  );
}

export async function depositInvestorVaultsViaPrivyEarn(input: {
  privyAccessToken: string;
  walletAddress: string;
  deposits: VaultDepositLine[];
  idempotencyPrefix?: string;
}): Promise<InvestorEarnDepositResult> {
  if (!depositsEligibleForPrivyEarn(input.deposits)) {
    throw new Error('PRIVY_EARN_DEPOSIT_NOT_ELIGIBLE');
  }

  const { walletId } = await resolveInvestorPrivyWalletId({
    privyAccessToken: input.privyAccessToken,
    walletAddress: input.walletAddress
  });

  let lastResult: InvestorEarnDepositResult | null = null;

  for (const [index, line] of input.deposits.entries()) {
    const vaultId = resolvePrivyEarnVaultId(line.vaultAddress);
    if (!vaultId) {
      throw new Error('PRIVY_EARN_VAULT_NOT_MAPPED');
    }

    const initiated = await depositToPrivyVault({
      walletId,
      vaultId,
      amount: line.amountUsd.toFixed(6).replace(/\.?0+$/, ''),
      idempotencyKey: input.idempotencyPrefix ? `${input.idempotencyPrefix}:${index}` : undefined
    });

    const settled = await waitForPrivyEarnAction({
      walletId,
      actionId: initiated.id
    });

    lastResult = {
      actionId: initiated.id,
      walletId,
      vaultId,
      status: settled.status,
      transactionHash: settled.transactionHash
    };
  }

  if (!lastResult?.transactionHash) {
    throw new Error('PRIVY_EARN_DEPOSIT_TX_MISSING');
  }

  return lastResult;
}

export async function readInvestorPrivyEarnPosition(input: {
  privyAccessToken: string;
  walletAddress: string;
  vaultAddress?: string | null;
}) {
  const { walletId } = await resolveInvestorPrivyWalletId({
    privyAccessToken: input.privyAccessToken,
    walletAddress: input.walletAddress
  });

  const vaultId = resolvePrivyEarnVaultId(input.vaultAddress) ?? privyVaultId();
  if (!vaultId) {
    throw new Error('PRIVY_EARN_VAULT_NOT_CONFIGURED');
  }

  return getPrivyWalletEarnPosition(walletId, vaultId);
}

export { getPrivyVaultDetails } from './earnApi';
