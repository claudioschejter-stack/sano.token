import { Interface } from 'ethers';
import type { PreparedTransaction } from './aaveBorrow';

const AAVE_POOL_ABI = [
  'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)',
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)'
];

const poolInterface = new Interface(AAVE_POOL_ABI);

export function prepareAaveV3SupplyWeth(
  poolAddress: string,
  weth: string,
  amountWei: bigint,
  onBehalfOf: string
): PreparedTransaction {
  const data = poolInterface.encodeFunctionData('supply', [weth, amountWei, onBehalfOf, 0]);

  return {
    to: poolAddress,
    data,
    value: '0',
    description: 'Supply WETH collateral (Aave v3 compatible pool)'
  };
}

export function prepareAaveV3BorrowUsdc(
  poolAddress: string,
  usdc: string,
  amountBaseUnits: bigint,
  onBehalfOf: string,
  protocolLabel: string
): PreparedTransaction {
  const data = poolInterface.encodeFunctionData('borrow', [usdc, amountBaseUnits, 2, 0, onBehalfOf]);

  return {
    to: poolAddress,
    data,
    value: '0',
    description: `Borrow USDC on ${protocolLabel}`
  };
}
