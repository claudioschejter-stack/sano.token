import { prepareVaultDepositPayment, type VaultDepositLine } from '../web3/vaultDepositPayment';
import { isPrivyAuthorizationSigningConfigured } from './privyAuthorizationSignature';
import { resolveInvestorPrivyWalletIdForUser } from './resolveInvestorPrivyWalletId';
import { privySendTransaction } from './walletRpcApi';
import {
  depositsEligibleForPrivyEarn,
  depositInvestorVaultsViaServer,
  type InvestorEarnDepositResult
} from './investorPrivyEarnService';

export type ServerVaultDepositResult = {
  transactionHash: `0x${string}`;
  walletAddress: string;
  mode: 'privy_earn' | 'onchain_prepare';
  earn?: InvestorEarnDepositResult;
};

export function isServerVaultDepositConfigured(): boolean {
  return Boolean(process.env.PRIVY_APP_SECRET?.trim()) && isPrivyAuthorizationSigningConfigured();
}

/**
 * Deposit USDC from the investor's linked Sanova/Privy wallet into a Morpho/ERC-4626 vault.
 * Prefers Privy Earn when mapped; otherwise prepares approve+deposit and sends via authorization key.
 */
export async function depositInvestorVaultFromSanovaWallet(input: {
  userId: string;
  deposits: VaultDepositLine[];
  idempotencyPrefix?: string;
}): Promise<ServerVaultDepositResult> {
  if (!input.deposits.length) {
    throw new Error('VAULT_DEPOSIT_LINES_REQUIRED');
  }

  if (depositsEligibleForPrivyEarn(input.deposits)) {
    const earn = await depositInvestorVaultsViaServer({
      userId: input.userId,
      deposits: input.deposits,
      idempotencyPrefix: input.idempotencyPrefix
    });
    if (!earn.transactionHash) {
      throw new Error('PRIVY_EARN_DEPOSIT_TX_MISSING');
    }
    return {
      transactionHash: earn.transactionHash,
      walletAddress: earn.walletAddress,
      mode: 'privy_earn',
      earn
    };
  }

  if (!isServerVaultDepositConfigured()) {
    throw new Error('PRIVY_SERVER_VAULT_DEPOSIT_NOT_CONFIGURED');
  }

  const walletRef = await resolveInvestorPrivyWalletIdForUser(input.userId);
  if (!walletRef) {
    throw new Error('PRIVY_WALLET_ID_NOT_FOUND');
  }

  const prepared = prepareVaultDepositPayment({
    stablecoinNetwork: 'BASE',
    payerAddress: walletRef.address,
    deposits: input.deposits
  });

  let lastHash: string | null = null;
  for (const [index, tx] of prepared.transactions.entries()) {
    lastHash = await privySendTransaction({
      walletId: walletRef.walletId,
      chainId: prepared.chainId,
      to: tx.to,
      data: tx.data,
      value: BigInt(tx.value || '0'),
      // User pays gas in USDC (not app gas credits).
      sponsor: true,
      sponsorAsset: 'usdc',
      idempotencyKey: input.idempotencyPrefix
        ? `${input.idempotencyPrefix}:tx:${index}`
        : undefined,
      requireAuthorizationSignature: true
    });
  }

  if (!lastHash?.startsWith('0x')) {
    throw new Error('VAULT_DEPOSIT_TX_FAILED');
  }

  return {
    transactionHash: lastHash as `0x${string}`,
    walletAddress: walletRef.address,
    mode: 'onchain_prepare'
  };
}
