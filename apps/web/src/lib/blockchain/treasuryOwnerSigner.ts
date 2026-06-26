import { JsonRpcProvider, type Signer, getAddress, isAddress } from 'ethers';
import {
  isPrivySafeOwnerConfigured,
  privySafeOwnerAddress,
  privySafeOwnerWalletId
} from '../privy/config';
import { PrivyServerWalletSigner } from '../privy/privyServerWalletSigner';

// Bare private key fallbacks (TREASURY_OWNER_PRIVATE_KEY /
// TOKEN_TREASURY_SIGNER_PRIVATE_KEY) have been intentionally removed.
// Treasury owner signing must go through a Privy server wallet.
export function isTreasuryOwnerSignerConfigured(): boolean {
  return isPrivySafeOwnerConfigured();
}

/** Address of the Privy-managed Safe owner wallet. */
export function resolveTreasuryOwnerAddress(): string | null {
  if (!isPrivySafeOwnerConfigured()) {
    return null;
  }
  return privySafeOwnerAddress();
}

export async function resolveTreasuryOwnerSigner(
  provider: JsonRpcProvider,
  chainId: number
): Promise<Signer | null> {
  if (!isPrivySafeOwnerConfigured()) {
    throw new Error('TREASURY_OWNER_NOT_CONFIGURED: Privy safe owner wallet required');
  }

  const address = privySafeOwnerAddress();
  if (!address || !isAddress(address)) {
    throw new Error('PRIVY_SAFE_OWNER_ADDRESS_INVALID');
  }

  return new PrivyServerWalletSigner(
    privySafeOwnerWalletId(),
    getAddress(address),
    provider,
    chainId
  );
}
