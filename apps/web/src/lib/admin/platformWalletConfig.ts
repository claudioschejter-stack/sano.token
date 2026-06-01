import { Wallet } from 'ethers';
import { resolveTreasuryAddress } from '../blockchain/treasuryPolicy';

export type PlatformWalletConfig = {
  chainId: number;
  chainName: string;
  tokenTreasuryAddress: string | null;
  rwaOperatorAddress: string | null;
  stablecoinTreasuryAddress: string | null;
  deployerAddress: string | null;
  explorerBaseUrl: string;
};

function readDeployerAddress(): string | null {
  const privateKey =
    process.env.TOKEN_DEPLOY_PRIVATE_KEY?.trim() || process.env.PRIVATE_KEY?.trim() || null;

  if (!privateKey) {
    return null;
  }

  try {
    return new Wallet(privateKey).address;
  } catch {
    return null;
  }
}

export function getPlatformWalletConfig(): PlatformWalletConfig {
  const chainId = Number(process.env.MORPHO_CHAIN_ID ?? process.env.LENDING_CHAIN_ID ?? '8453');
  const chainName = chainId === 8453 ? 'Base Mainnet' : chainId === 84532 ? 'Base Sepolia' : `Chain ${chainId}`;
  const explorerBaseUrl =
    chainId === 8453
      ? 'https://basescan.org'
      : chainId === 84532
        ? 'https://sepolia.basescan.org'
        : 'https://basescan.org';

  return {
    chainId,
    chainName,
    tokenTreasuryAddress: resolveTreasuryAddress(),
    rwaOperatorAddress: process.env.RWA_OPERATOR_ADDRESS?.trim() || null,
    stablecoinTreasuryAddress:
      process.env.BASE_STABLECOIN_TREASURY_ADDRESS?.trim() ||
      process.env.STABLECOIN_TREASURY_ADDRESS?.trim() ||
      resolveTreasuryAddress(),
    deployerAddress: readDeployerAddress(),
    explorerBaseUrl
  };
}
