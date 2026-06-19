import { JsonRpcProvider, Wallet, type Signer, getAddress, isAddress } from 'ethers';
import {
  isPrivySafeOwnerConfigured,
  privySafeOwnerAddress,
  privySafeOwnerWalletId
} from '../privy/config';
import { PrivyServerWalletSigner } from '../privy/privyServerWalletSigner';

export function isTreasuryOwnerSignerConfigured(): boolean {
  return (
    isPrivySafeOwnerConfigured() ||
    Boolean(
      process.env.TREASURY_OWNER_PRIVATE_KEY?.trim() ||
        process.env.TOKEN_TREASURY_SIGNER_PRIVATE_KEY?.trim()
    )
  );
}

export function resolveTreasuryOwnerAddress(): string | null {
  if (isPrivySafeOwnerConfigured()) {
    return privySafeOwnerAddress();
  }

  const privateKey =
    process.env.TREASURY_OWNER_PRIVATE_KEY?.trim() ||
    process.env.TOKEN_TREASURY_SIGNER_PRIVATE_KEY?.trim();

  if (!privateKey) {
    return null;
  }

  try {
    return new Wallet(privateKey).address;
  } catch {
    return null;
  }
}

export async function resolveTreasuryOwnerSigner(
  provider: JsonRpcProvider,
  chainId: number
): Promise<Signer | null> {
  if (isPrivySafeOwnerConfigured()) {
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

  const privateKey =
    process.env.TREASURY_OWNER_PRIVATE_KEY?.trim() ||
    process.env.TOKEN_TREASURY_SIGNER_PRIVATE_KEY?.trim();

  if (!privateKey) {
    return null;
  }

  return new Wallet(privateKey, provider);
}
