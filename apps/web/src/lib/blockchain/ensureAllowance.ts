import { Contract, MaxUint256, type Signer } from 'ethers';
import { waitForAutomationTx } from './automationTx';

/**
 * Approve a spender only when the existing allowance is not already enough.
 *
 * An `approve` that grants what was already granted is a whole transaction that
 * changes nothing, and the infinite-allowance pattern makes it easy to miss: the
 * call reads as setup, but on a daily cron it is a daily cost. Reading the
 * allowance first is free.
 */

const ERC20_ABI = [
  'function allowance(address owner,address spender) view returns (uint256)',
  'function approve(address spender,uint256 amount) returns (bool)'
];

export type EnsureAllowanceResult = {
  /** False when the existing allowance already covered the amount. */
  approved: boolean;
  txHash: string | null;
  allowance: string;
};

export async function ensureAllowance(input: {
  token: string;
  owner: string;
  spender: string;
  /** The minimum the spender needs. Defaults to an infinite grant. */
  amount?: bigint;
  signer: Signer;
}): Promise<EnsureAllowanceResult> {
  const needed = input.amount ?? MaxUint256;
  const token = new Contract(input.token, ERC20_ABI, input.signer);

  const current = (await token
    .allowance(input.owner, input.spender)
    .catch(() => null)) as bigint | null;

  if (current !== null && current >= needed) {
    return { approved: false, txHash: null, allowance: current.toString() };
  }

  const tx = await token.approve(input.spender, needed);
  const receipt = await waitForAutomationTx(tx);
  return {
    approved: true,
    txHash: receipt?.hash ?? tx.hash,
    allowance: needed.toString()
  };
}
