import type { Contract } from 'ethers';
import { readWithRetry } from './rpcRetry';

/**
 * Confirm the whitelist reached the state we asked for, allowing for lag.
 *
 * Reading `kycApproved` the instant a transaction confirms can return the state
 * from before it: the node that answers the read may not have the block yet. A
 * successful approval was reported as a failure for exactly that reason, and the
 * same response then showed the investor as approved on-chain two lines below —
 * so the write had worked and only the check was wrong.
 *
 * Failing after retries still matters: a module whose scope was revoked mid-way
 * would confirm a transaction that changes nothing.
 */
export async function confirmKycState(input: {
  token: Contract;
  walletAddress: string;
  approved: boolean;
  attempts?: number;
  delayMs?: number;
}): Promise<boolean> {
  const attempts = input.attempts ?? 4;
  const delayMs = input.delayMs ?? 1500;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const value = await readWithRetry(
      () => input.token.kycApproved(input.walletAddress) as Promise<boolean>
    );

    if (value !== null && Boolean(value) === input.approved) {
      return true;
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return false;
}
