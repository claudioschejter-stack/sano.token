import { Contract, Interface, JsonRpcProvider, getAddress } from 'ethers';
import { resolveInvestorPrivyWalletIdForUser } from '../privy/resolveInvestorPrivyWalletId';
import { privySendTransaction } from '../privy/walletRpcApi';
import { confirmOnChain } from '../blockchain/confirmOnChain';
import { readWithRetry } from '../blockchain/rpcRetry';

/**
 * Let the treasury operator pull the seller's shares.
 *
 * Both ways out of a position — selling back to the platform and selling to
 * another investor — settle with `transferFrom`, which needs the seller to have
 * approved the operator first. Nothing ever asked for that approval and nothing
 * offered a way to give it, so "Vender" reached the settlement, failed with
 * `SELLER_VAULT_ALLOWANCE_REQUIRED`, and left the investor with a button that
 * does not work.
 *
 * The approval does not need a new screen. The seller's wallet is a Sanova
 * wallet the platform can sign for, which is how their purchases are paid, so
 * the same signature can grant the allowance as part of the sale itself.
 *
 * Granted for exactly what is being sold, not infinitely: the operator should
 * only ever be able to move the shares the investor is selling right now.
 */

const VAULT_ABI = [
  'function allowance(address owner,address spender) view returns (uint256)',
  'function approve(address spender,uint256 amount) returns (bool)'
];

export type SellerAllowanceResult =
  | { ok: true; status: 'ALREADY_APPROVED' | 'APPROVED'; txHash?: string }
  | { ok: false; code: string; detail?: string };

export async function ensureSellerVaultAllowance(input: {
  userId: string;
  vaultAddress: string;
  operatorAddress: string;
  shareAmount: bigint;
  chainId: number;
  provider: JsonRpcProvider;
}): Promise<SellerAllowanceResult> {
  const walletRef = await resolveInvestorPrivyWalletIdForUser(input.userId).catch(() => null);
  if (!walletRef?.walletId || !walletRef.address) {
    return { ok: false, code: 'SELLER_WALLET_NOT_FOUND' };
  }

  const vault = new Contract(getAddress(input.vaultAddress), VAULT_ABI, input.provider);
  const current = await readWithRetry(
    () => vault.allowance(walletRef.address, getAddress(input.operatorAddress)) as Promise<bigint>
  );

  if (current !== null && current >= input.shareAmount) {
    return { ok: true, status: 'ALREADY_APPROVED' };
  }

  const data = new Interface(VAULT_ABI).encodeFunctionData('approve', [
    getAddress(input.operatorAddress),
    input.shareAmount
  ]);

  let txHash: string;
  try {
    txHash = await privySendTransaction({
      walletId: walletRef.walletId,
      chainId: input.chainId,
      to: getAddress(input.vaultAddress),
      data,
      /**
       * The platform pays this one. It is a fraction of a cent, and charging the
       * investor gas to be allowed to sell would put a funding problem between
       * them and their own money.
       */
      sponsor: true,
      requireAuthorizationSignature: true,
      idempotencyKey: `vault-approve:${input.userId}:${input.vaultAddress}:${input.shareAmount}`
    });
  } catch (error) {
    return {
      ok: false,
      code: 'SELLER_VAULT_APPROVE_FAILED',
      detail: error instanceof Error ? error.message.slice(0, 250) : undefined
    };
  }

  // The approval has to be visible before the settlement reads it.
  const confirmation = await confirmOnChain({
    read: () =>
      vault.allowance(walletRef.address, getAddress(input.operatorAddress)) as Promise<bigint>,
    satisfied: (allowance) => allowance >= input.shareAmount
  });

  if (!confirmation.confirmed) {
    return {
      ok: false,
      code: 'SELLER_VAULT_ALLOWANCE_NOT_VISIBLE',
      detail: `La aprobación ${txHash} se envió pero todavía no se lee en la cadena. Reintentá en un minuto.`
    };
  }

  return { ok: true, status: 'APPROVED', txHash };
}
