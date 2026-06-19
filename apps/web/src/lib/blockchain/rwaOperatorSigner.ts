import { JsonRpcProvider, Wallet, type Signer, getAddress, isAddress } from 'ethers';
import {
  isPrivyOperatorConfigured,
  privyOperatorWalletId,
  resolveRwaOperatorAddressEnv
} from '../privy/config';
import { PrivyServerWalletSigner } from '../privy/privyServerWalletSigner';

export function isRwaOperatorConfigured(): boolean {
  return (
    isPrivyOperatorConfigured() ||
    Boolean(process.env.TOKEN_DEPLOY_PRIVATE_KEY?.trim() || process.env.PRIVATE_KEY?.trim())
  );
}

/** On-chain operator address (Privy server wallet or legacy deploy key). */
export function resolveRwaOperatorAddress(): string | null {
  if (isPrivyOperatorConfigured()) {
    return resolveRwaOperatorAddressEnv();
  }

  const privateKey =
    process.env.TOKEN_DEPLOY_PRIVATE_KEY?.trim() || process.env.PRIVATE_KEY?.trim();

  if (!privateKey) {
    return null;
  }

  try {
    return new Wallet(privateKey).address;
  } catch {
    return null;
  }
}

export async function resolveRwaOperatorSigner(
  provider: JsonRpcProvider,
  chainId: number
): Promise<Signer | null> {
  if (isPrivyOperatorConfigured()) {
    const address = resolveRwaOperatorAddressEnv();
    if (!address || !isAddress(address)) {
      throw new Error('RWA_OPERATOR_ADDRESS_INVALID');
    }

    return new PrivyServerWalletSigner(
      privyOperatorWalletId(),
      getAddress(address),
      provider,
      chainId
    );
  }

  const privateKey =
    process.env.TOKEN_DEPLOY_PRIVATE_KEY?.trim() || process.env.PRIVATE_KEY?.trim();

  if (!privateKey) {
    return null;
  }

  return new Wallet(privateKey, provider);
}
