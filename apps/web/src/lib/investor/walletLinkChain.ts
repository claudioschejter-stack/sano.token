import { BASE_CHAIN_ID } from '../web3/config';

/** Wallet linking is Base-only — server enforces this regardless of client chainId. */
export const WALLET_LINK_CHAIN_ID = BASE_CHAIN_ID;

export function assertWalletLinkChainId(chainId: number | undefined | null): void {
  if (chainId != null && chainId !== WALLET_LINK_CHAIN_ID) {
    throw new Error('CHAIN_MISMATCH');
  }
}
