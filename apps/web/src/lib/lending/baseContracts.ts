import { getAddress } from 'ethers';
import { BASE_MAINNET_CHAIN_ID } from '../blockchain/supportedChains';

export type LendingChainConfig = {
  chainId: number;
  usdc: string;
  weth: string;
  morpho: string;
  morphoIrm: string;
  morphoDefaultLltvBps: number;
};

const BASE_MAINNET: LendingChainConfig = {
  chainId: BASE_MAINNET_CHAIN_ID,
  usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  weth: '0x4200000000000000000000000000000000000006',
  morpho: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
  morphoIrm: getAddress('0x46415998764c29ab2a25cbea6254146d50d22687'),
  morphoDefaultLltvBps: 6250
};

export function getLendingChainConfig(): LendingChainConfig {
  return BASE_MAINNET;
}

export function getLendingChainConfigForChain(chainId: number): LendingChainConfig {
  if (chainId !== BASE_MAINNET_CHAIN_ID) {
    return BASE_MAINNET;
  }
  return BASE_MAINNET;
}

export const EXECUTABLE_BORROW_PROTOCOLS = ['morpho'] as const;

export type ExecutableBorrowProtocol = (typeof EXECUTABLE_BORROW_PROTOCOLS)[number];

export function listExecutableProtocolsForChain(
  _config: LendingChainConfig = getLendingChainConfig()
): ExecutableBorrowProtocol[] {
  return ['morpho'];
}

export function isExecutableBorrowProtocol(id: string): id is ExecutableBorrowProtocol {
  return id === 'morpho';
}
