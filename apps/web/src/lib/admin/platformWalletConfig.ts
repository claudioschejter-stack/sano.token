import { resolveTreasuryAddress } from '../blockchain/treasuryPolicy';
import { isRwaOperatorConfigured, resolveRwaOperatorAddress } from '../blockchain/rwaOperatorSigner';

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
  const rwaOperatorAddress = resolveRwaOperatorAddress();
  const stablecoinTreasuryAddress =
    process.env.BASE_STABLECOIN_TREASURY_ADDRESS?.trim() ||
    process.env.STABLECOIN_TREASURY_ADDRESS?.trim() ||
    resolveTreasuryAddress();
  const deployerAddress = rwaOperatorAddress;
  const usesPrivyOperator = Boolean(process.env.PRIVY_OPERATOR_WALLET_ID?.trim());

  const envEntries: PlatformWalletEnvEntry[] = [
    {
      key: 'TOKEN_TREASURY_ADDRESS',
      label: 'tokenTreasury',
      configured: Boolean(tokenTreasuryAddress),
      address: tokenTreasuryAddress
    },
    {
      key: usesPrivyOperator ? 'PRIVY_OPERATOR_WALLET_ID' : 'RWA_OPERATOR_ADDRESS',
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
      key: usesPrivyOperator ? 'PRIVY_OPERATOR_WALLET_ID' : 'TOKEN_DEPLOY_PRIVATE_KEY',
      label: 'deployer',
      configured: isRwaOperatorConfigured(),
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
