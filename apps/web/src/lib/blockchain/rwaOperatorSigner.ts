import { JsonRpcProvider, type Signer, getAddress, isAddress } from 'ethers';
import {
  isPrivyOperatorConfigured,
  privyOperatorWalletId,
  resolveRwaOperatorAddressEnv
} from '../privy/config';
import { PrivyServerWalletSigner } from '../privy/privyServerWalletSigner';

// Single-key fallbacks (TOKEN_DEPLOY_PRIVATE_KEY / PRIVATE_KEY) have been
// intentionally removed. The operator MUST be a Privy server wallet so that
// signing never relies on a bare private key stored in an environment variable.
export function isRwaOperatorConfigured(): boolean {
  return isPrivyOperatorConfigured();
}

/** On-chain operator address — always resolved through Privy. */
export function resolveRwaOperatorAddress(): string | null {
  if (!isPrivyOperatorConfigured()) {
    return null;
  }
  return resolveRwaOperatorAddressEnv();
}

export async function resolveRwaOperatorSigner(
  provider: JsonRpcProvider,
  chainId: number
): Promise<Signer | null> {
  if (!isPrivyOperatorConfigured()) {
    throw new Error('RWA_OPERATOR_NOT_CONFIGURED: Privy server wallet required');
  }

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
