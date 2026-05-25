import { Contract, JsonRpcProvider } from 'ethers';
import { resolveChainId } from '../blockchain/explorerUrls';
import { rayToApyBps } from './fetchDefiLlamaBorrowRates';

/** Base mainnet / Base Sepolia Aave v3 Pool + USDC */
const AAVE_POOL_BY_CHAIN: Record<number, string> = {
  8453: '0xA238Dd80C259a72e81d7e4664a9801595FD8b26',
  84532: '0x07eA79F6680653E51e0DDC7141a7f7d658a5f8c4'
};

const USDC_BY_CHAIN: Record<number, string> = {
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  84532: '0x036CbD53842c797964cc9E7920680AA85945E435'
};

const POOL_ABI = [
  'function getReserveData(address asset) view returns (tuple(uint256 configuration,uint128 liquidityIndex,uint128 currentLiquidityRate,uint128 variableBorrowIndex,uint128 currentVariableBorrowRate,uint128 currentStableBorrowRate,uint40 lastUpdateTimestamp,uint16 id,address aTokenAddress,address stableDebtTokenAddress,address variableDebtTokenAddress,address interestRateStrategyAddress,uint128 accruedToTreasury,uint128 unbacked,uint128 isolationModeTotalDebt))'
];

function resolveRpcUrl(chainId: number): string {
  if (chainId === 8453) {
    return process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
  }
  if (chainId === 84532) {
    return process.env.BASE_RPC_URL?.trim() || 'https://sepolia.base.org';
  }
  return process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
}

export type OnChainBorrowQuote = {
  lenderId: string;
  borrowApyBps: number;
  source: string;
  chainId: number;
};

/** Reads Aave v3 USDC variable borrow rate on the configured deployment chain. */
export async function fetchOnChainBorrowQuotes(): Promise<Map<string, OnChainBorrowQuote>> {
  if (process.env.LENDING_ONCHAIN_RATES === 'false') {
    return new Map();
  }

  const chainId = resolveChainId();
  const poolAddress = AAVE_POOL_BY_CHAIN[chainId];
  const usdcAddress = USDC_BY_CHAIN[chainId];

  if (!poolAddress || !usdcAddress) {
    return new Map();
  }

  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
  try {
    const pool = new Contract(poolAddress, POOL_ABI, provider);
    const reserve = await pool.getReserveData(usdcAddress);
    const variableBorrowRate = reserve.currentVariableBorrowRate as bigint;
    const borrowApyBps = rayToApyBps(variableBorrowRate);

    if (borrowApyBps <= 0) {
      return new Map();
    }

    const quote: OnChainBorrowQuote = {
      lenderId: 'aave',
      borrowApyBps,
      source: `onchain:aave-v3:${chainId}:usdc`,
      chainId
    };

    return new Map([['aave', quote]]);
  } catch (error) {
    console.warn('[lending/onchain] Aave reserve read failed', error);
    return new Map();
  } finally {
    provider.destroy();
  }
}
