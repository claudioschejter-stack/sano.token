import { getAddress } from 'ethers';
import { resolveMorphoChainId } from '../blockchain/explorerUrls';
import { PLUME_MAINNET_CHAIN_ID, PLUME_TESTNET_CHAIN_ID } from '../blockchain/supportedChains';

export type MoonwellChainConfig = {
  comptroller: string;
  mUsdc: string;
  mWeth: string;
  weth: string;
};

export type CompoundChainConfig = {
  comet: string;
  weth: string;
  usdc: string;
};

export type SparkChainConfig = {
  pool: string;
  usdc: string;
  weth: string;
};

export type LendingChainConfig = {
  chainId: number;
  aavePool: string;
  usdc: string;
  weth: string;
  morpho: string;
  morphoIrm: string;
  /** Default LLTV in basis points (e.g. 6250 = 62.5%). Must be enabled on Morpho for the chain. */
  morphoDefaultLltvBps?: number;
  moonwell?: MoonwellChainConfig;
  compound?: CompoundChainConfig;
  spark?: SparkChainConfig;
};

const BASE_MAINNET: LendingChainConfig = {
  chainId: 8453,
  aavePool: '0xA238Dd80C259a72e81d7e4664a9801595FD8b26',
  usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  weth: '0x4200000000000000000000000000000000000006',
  morpho: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
  morphoIrm: getAddress('0x46415998764c29ab2a25cbea6254146d50d22687'),
  morphoDefaultLltvBps: 6250,
  moonwell: {
    comptroller: '0xfBb21d0380beE3312B33c4353c8936a0F13EF26C',
    mUsdc: '0xEdc817A28E8B93B03976FBd4a3dDBc9f7D176c22',
    mWeth: '0x628ff693426583D9a7FB391E54366292F509D457',
    weth: '0x4200000000000000000000000000000000000006'
  },
  compound: {
    comet: '0xb125E6687d4313864e53df431d5425969c15Eb2F',
    weth: '0x4200000000000000000000000000000000000006',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
  }
};

const BASE_SEPOLIA: LendingChainConfig = {
  chainId: 84532,
  aavePool: getAddress('0x07ea79f6680653e51e0ddc7141a7f7d658a5f8c4'),
  usdc: getAddress('0x036CbD53842c5426634e7929541eC2318f3dCF7e'),
  weth: '0x4200000000000000000000000000000000000006',
  morpho: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
  morphoIrm: getAddress('0x870ac11d48b15db9f1382786706e8e7a239d8928')
};

const ETHEREUM_MAINNET: LendingChainConfig = {
  chainId: 1,
  aavePool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
  usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  morpho: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
  morphoIrm: getAddress('0x870ac11d48b15db9a138cf899d20f13f79ba00bc'),
  morphoDefaultLltvBps: 8600,
  spark: {
    pool: '0xC13e21B648A5Ee794902342038FF3aDAB66BE987',
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  }
};

/** Morpho Blue is deployed at the same address on many EVM chains including Plume. */
const MORPHO_BLUE_ADDRESS = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb';

const PLUME_MAINNET: LendingChainConfig = {
  chainId: PLUME_MAINNET_CHAIN_ID,
  aavePool: '',
  usdc:
    process.env.PLUME_USDC_TOKEN_ADDRESS?.trim() ||
    process.env.NEXT_PUBLIC_PLUME_USDC_TOKEN_ADDRESS?.trim() ||
    '',
  weth: process.env.PLUME_WETH_TOKEN_ADDRESS?.trim() || '',
  morpho: process.env.MORPHO_PLUME_ADDRESS?.trim() || MORPHO_BLUE_ADDRESS,
  morphoIrm: getAddress(
    process.env.MORPHO_PLUME_IRM_ADDRESS?.trim() || '0x46415998764c29ab2a25cbea6254146d50d22687'
  ),
  morphoDefaultLltvBps: Number.parseInt(process.env.MORPHO_PLUME_LLTV_BPS?.trim() || '6250', 10)
};

const PLUME_TESTNET: LendingChainConfig = {
  chainId: PLUME_TESTNET_CHAIN_ID,
  aavePool: '',
  usdc: process.env.PLUME_TESTNET_USDC_TOKEN_ADDRESS?.trim() || '',
  weth: '',
  morpho: process.env.MORPHO_PLUME_TESTNET_ADDRESS?.trim() || MORPHO_BLUE_ADDRESS,
  morphoIrm: getAddress(
    process.env.MORPHO_PLUME_TESTNET_IRM_ADDRESS?.trim() || '0x870ac11d48b15db9f1382786706e8e7a239d8928'
  ),
  morphoDefaultLltvBps: 6250
};

const CHAIN_CONFIGS: Record<number, LendingChainConfig> = {
  8453: BASE_MAINNET,
  84532: BASE_SEPOLIA,
  1: ETHEREUM_MAINNET,
  [PLUME_MAINNET_CHAIN_ID]: PLUME_MAINNET,
  [PLUME_TESTNET_CHAIN_ID]: PLUME_TESTNET
};

export function getLendingChainConfig(): LendingChainConfig {
  const chainId = resolveMorphoChainId();
  return getLendingChainConfigForChain(chainId);
}

export function getLendingChainConfigForChain(chainId: number): LendingChainConfig {
  return CHAIN_CONFIGS[chainId] ?? BASE_MAINNET;
}

/** All protocols Sanova can prepare borrow transactions for (when configured on chain). */
export const EXECUTABLE_BORROW_PROTOCOLS = ['aave', 'morpho', 'moonwell', 'compound', 'spark'] as const;

export type ExecutableBorrowProtocol = (typeof EXECUTABLE_BORROW_PROTOCOLS)[number];

export function listExecutableProtocolsForChain(config: LendingChainConfig = getLendingChainConfig()): ExecutableBorrowProtocol[] {
  const protocols: ExecutableBorrowProtocol[] = ['aave', 'morpho'];

  if (config.moonwell) {
    protocols.push('moonwell');
  }
  if (config.compound) {
    protocols.push('compound');
  }
  if (config.spark) {
    protocols.push('spark');
  }

  return protocols;
}

export function isExecutableBorrowProtocol(
  id: string,
  config: LendingChainConfig = getLendingChainConfig()
): id is ExecutableBorrowProtocol {
  return listExecutableProtocolsForChain(config).includes(id as ExecutableBorrowProtocol);
}

/** WETH-collateral protocols (not Morpho RWA vault). */
export const WETH_COLLATERAL_PROTOCOLS = ['aave', 'spark', 'moonwell', 'compound'] as const;

export type WethCollateralProtocol = (typeof WETH_COLLATERAL_PROTOCOLS)[number];

export function isWethCollateralProtocol(id: string): id is WethCollateralProtocol {
  return WETH_COLLATERAL_PROTOCOLS.includes(id as WethCollateralProtocol);
}
