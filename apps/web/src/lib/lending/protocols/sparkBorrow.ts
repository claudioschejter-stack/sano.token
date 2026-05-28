import { getLendingChainConfig } from '../baseContracts';
import { prepareAaveV3BorrowUsdc, prepareAaveV3SupplyWeth } from './aaveV3PoolBorrow';
import type { PreparedTransaction } from './aaveBorrow';

export function prepareSparkSupplyWeth(amountWei: bigint, onBehalfOf: string): PreparedTransaction | null {
  const spark = getLendingChainConfig().spark;
  if (!spark) {
    return null;
  }

  return prepareAaveV3SupplyWeth(spark.pool, spark.weth, amountWei, onBehalfOf);
}

export function prepareSparkBorrowUsdc(amountBaseUnits: bigint, onBehalfOf: string): PreparedTransaction | null {
  const spark = getLendingChainConfig().spark;
  if (!spark) {
    return null;
  }

  return prepareAaveV3BorrowUsdc(spark.pool, spark.usdc, amountBaseUnits, onBehalfOf, 'SparkLend');
}
