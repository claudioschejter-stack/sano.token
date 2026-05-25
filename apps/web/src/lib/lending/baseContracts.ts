import { resolveChainId } from '../blockchain/deployAssetToken';

export type LendingChainConfig = {
  chainId: number;
  aavePool: string;
  usdc: string;
  weth: string;
  morpho: string;
  morphoIrm: string;
};

const BASE_MAINNET: LendingChainConfig = {
  chainId: 8453,
  aavePool: '0xA238Dd80C259a72e81d7e4664a9801595FD8b26',
  usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  weth: '0x4200000000000000000000000000000000000006',
  morpho: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
  morphoIrm: '0x870aC11D48B15DB9f1382786706e8e7A239D8928'
};

const BASE_SEPOLIA: LendingChainConfig = {
  chainId: 84532,
  aavePool: '0x07eA79F6680653E51e0DDC7141a7f7d658a5f8c4',
  usdc: '0x036CbD53842c797964cc9E7920680AA85945E435',
  weth: '0x4200000000000000000000000000000000000006',
  morpho: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
  morphoIrm: '0x870aC11D48B15DB9f1382786706e8e7A239D8928'
};

export function getLendingChainConfig(): LendingChainConfig {
  const chainId = resolveChainId();
  if (chainId === 84532) {
    return BASE_SEPOLIA;
  }
  return BASE_MAINNET;
}

/** Protocols Sanova can prepare executable borrow transactions for. */
export const EXECUTABLE_BORROW_PROTOCOLS = ['aave', 'morpho'] as const;

export type ExecutableBorrowProtocol = (typeof EXECUTABLE_BORROW_PROTOCOLS)[number];

export function isExecutableBorrowProtocol(id: string): id is ExecutableBorrowProtocol {
  return EXECUTABLE_BORROW_PROTOCOLS.includes(id as ExecutableBorrowProtocol);
}
