import { JsonRpcProvider, type Signer, getAddress, isAddress } from 'ethers';
import {
  isPrivyMorphoLiquidityConfigured,
  privyMorphoLiquidityAddress,
  privyMorphoLiquidityWalletId
} from '../privy/config';
import { PrivyServerWalletSigner } from '../privy/privyServerWalletSigner';

export function isMorphoLiquiditySignerConfigured(): boolean {
  return isPrivyMorphoLiquidityConfigured();
}

export function resolveMorphoLiquidityAddress(): string | null {
  return isPrivyMorphoLiquidityConfigured() ? privyMorphoLiquidityAddress() : null;
}

export async function resolveMorphoLiquiditySigner(
  provider: JsonRpcProvider,
  chainId: number
): Promise<Signer | null> {
  if (!isPrivyMorphoLiquidityConfigured()) {
    return null;
  }

  const address = privyMorphoLiquidityAddress();
  if (!address || !isAddress(address)) {
    throw new Error('MORPHO_LIQUIDITY_ADDRESS_INVALID');
  }

  return new PrivyServerWalletSigner(
    privyMorphoLiquidityWalletId(),
    getAddress(address),
    provider,
    chainId
  );
}
