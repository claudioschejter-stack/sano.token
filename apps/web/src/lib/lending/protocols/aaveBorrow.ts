import { getLendingChainConfig } from '../baseContracts';
import {
  prepareAaveV3BorrowUsdc,
  prepareAaveV3SupplyWeth
} from './aaveV3PoolBorrow';

export type PreparedTransaction = {
  to: string;
  data: string;
  value: string;
  description: string;
  marketId?: string;
};

export function prepareAaveSupplyWeth(amountWei: bigint, onBehalfOf: string): PreparedTransaction {
  const { aavePool, weth } = getLendingChainConfig();
  return prepareAaveV3SupplyWeth(aavePool, weth, amountWei, onBehalfOf);
}

export function prepareAaveBorrowUsdc(amountBaseUnits: bigint, onBehalfOf: string): PreparedTransaction {
  const { aavePool, usdc } = getLendingChainConfig();
  return prepareAaveV3BorrowUsdc(aavePool, usdc, amountBaseUnits, onBehalfOf, 'Aave v3');
}

export function usdcToBaseUnits(amountUsd: number): bigint {
  return BigInt(Math.round(amountUsd * 1_000_000));
}

export function ethToWei(amountEth: number): bigint {
  return BigInt(Math.round(amountEth * 1e18));
}
