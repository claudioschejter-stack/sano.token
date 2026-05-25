import { Interface } from 'ethers';
import { getLendingChainConfig } from '../baseContracts';

const AAVE_POOL_ABI = [
  'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)',
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)'
];

const poolInterface = new Interface(AAVE_POOL_ABI);

export type PreparedTransaction = {
  to: string;
  data: string;
  value: string;
  description: string;
};

export function prepareAaveSupplyWeth(amountWei: bigint, onBehalfOf: string): PreparedTransaction {
  const { aavePool, weth } = getLendingChainConfig();
  const data = poolInterface.encodeFunctionData('supply', [weth, amountWei, onBehalfOf, 0]);

  return {
    to: aavePool,
    data,
    value: '0',
    description: 'Supply WETH collateral on Aave v3'
  };
}

export function prepareAaveBorrowUsdc(amountBaseUnits: bigint, onBehalfOf: string): PreparedTransaction {
  const { aavePool, usdc } = getLendingChainConfig();
  const data = poolInterface.encodeFunctionData('borrow', [usdc, amountBaseUnits, 2, 0, onBehalfOf]);

  return {
    to: aavePool,
    data,
    value: '0',
    description: 'Borrow USDC on Aave v3 (variable rate)'
  };
}

export function usdcToBaseUnits(amountUsd: number): bigint {
  return BigInt(Math.round(amountUsd * 1_000_000));
}

export function ethToWei(amountEth: number): bigint {
  return BigInt(Math.round(amountEth * 1e18));
}
