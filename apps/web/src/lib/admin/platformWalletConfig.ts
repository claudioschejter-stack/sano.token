import { Wallet } from 'ethers';
import { resolveTreasuryAddress } from '../blockchain/treasuryPolicy';

export type PlatformWalletEnvEntry = {
  key: string;
  label: string;
  configured: boolean;
  address: string | null;
};

export type PlatformWalletConfig = {
  chainId: number;
  chainName: string;
  tokenTreasuryAddress: string | null;
  rwaOperatorAddress: string | null;
  stablecoinTreasuryAddress: string | null;
  deployerAddress: string | null;
  explorerBaseUrl: string;
  envEntries: PlatformWalletEnvEntry[];
  allOperationalConfigured: boolean;
  missingEnvKeys: string[];
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

  const tokenTreasuryAddress = resolveTreasuryAddress();
  const rwaOperatorAddress = process.env.RWA_OPERATOR_ADDRESS?.trim() || null;
  const stablecoinTreasuryAddress =
    process.env.BASE_STABLECOIN_TREASURY_ADDRESS?.trim() ||
    process.env.STABLECOIN_TREASURY_ADDRESS?.trim() ||
    resolveTreasuryAddress();
  const deployerAddress = readDeployerAddress();

  const envEntries: PlatformWalletEnvEntry[] = [
    {
      key: 'TOKEN_TREASURY_ADDRESS',
      label: 'tokenTreasury',
      configured: Boolean(tokenTreasuryAddress),
      address: tokenTreasuryAddress
    },
    {
      key: 'RWA_OPERATOR_ADDRESS',
      label: 'rwaOperator',
      configured: Boolean(rwaOperatorAddress),
      address: rwaOperatorAddress
    },
    {
      key: 'BASE_STABLECOIN_TREASURY_ADDRESS',
      label: 'stablecoinTreasury',
      configured: Boolean(stablecoinTreasuryAddress),
      address: stablecoinTreasuryAddress
    },
    {
      key: 'TOKEN_DEPLOY_PRIVATE_KEY',
      label: 'deployer',
      configured: Boolean(deployerAddress),
      address: deployerAddress
    }
  ];

  const missingEnvKeys = envEntries.filter((entry) => !entry.configured).map((entry) => entry.key);

  return {
    chainId,
    chainName,
    tokenTreasuryAddress,
    rwaOperatorAddress,
    stablecoinTreasuryAddress,
    deployerAddress,
    explorerBaseUrl,
    envEntries,
    allOperationalConfigured: missingEnvKeys.length === 0,
    missingEnvKeys
  };
}
