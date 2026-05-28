import { Contract, JsonRpcProvider } from 'ethers';
import { getLendingChainConfigForChain } from './baseContracts';
import { resolveChainId } from '../blockchain/explorerUrls';
import { rayToApyBps } from './fetchDefiLlamaBorrowRates';

const POOL_ABI = [
  'function getReserveData(address asset) view returns (tuple(uint256 configuration,uint128 liquidityIndex,uint128 currentLiquidityRate,uint128 variableBorrowIndex,uint128 currentVariableBorrowRate,uint128 currentStableBorrowRate,uint40 lastUpdateTimestamp,uint16 id,address aTokenAddress,address stableDebtTokenAddress,address variableDebtTokenAddress,address interestRateStrategyAddress,uint128 accruedToTreasury,uint128 unbacked,uint128 isolationModeTotalDebt))'
];

const MTOKEN_ABI = ['function borrowRatePerTimestamp() view returns (uint256)'];

const COMET_ABI = [
  'function getUtilization() view returns (uint256)',
  'function getBorrowRate(uint256 utilization) view returns (uint64)'
];

const SECONDS_PER_YEAR = 31_536_000;

function resolveRpcUrl(chainId: number): string {
  if (chainId === 8453) {
    return (
      process.env.LENDING_BASE_RPC_URL?.trim() ||
      process.env.BASE_RPC_URL?.trim() ||
      'https://mainnet.base.org'
    );
  }
  if (chainId === 84532) {
    return process.env.BASE_SEPOLIA_RPC_URL?.trim() || process.env.BASE_RPC_URL?.trim() || 'https://sepolia.base.org';
  }
  if (chainId === 1) {
    return process.env.ETHEREUM_RPC_URL?.trim() || 'https://eth.llamarpc.com';
  }
  return process.env.LENDING_BASE_RPC_URL?.trim() || process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
}

function perSecondRateToApyBps(ratePerSecond: bigint): number {
  const rate = Number(ratePerSecond) / 1e18;
  if (!Number.isFinite(rate) || rate <= 0) {
    return 0;
  }
  const apy = (Math.pow(1 + rate, SECONDS_PER_YEAR) - 1) * 100;
  return Math.max(0, Math.round(apy * 100));
}

export type OnChainBorrowQuote = {
  lenderId: string;
  borrowApyBps: number;
  source: string;
  chainId: number;
};

async function readAaveV3UsdcBorrowRate(
  provider: JsonRpcProvider,
  poolAddress: string,
  usdcAddress: string,
  lenderId: string,
  chainId: number
): Promise<OnChainBorrowQuote | null> {
  try {
    const pool = new Contract(poolAddress, POOL_ABI, provider);
    const reserve = await pool.getReserveData(usdcAddress);
    const variableBorrowRate = reserve.currentVariableBorrowRate as bigint;
    const borrowApyBps = rayToApyBps(variableBorrowRate);

    if (borrowApyBps <= 0) {
      return null;
    }

    return {
      lenderId,
      borrowApyBps,
      source: `onchain:${lenderId}:${chainId}:usdc`,
      chainId
    };
  } catch (error) {
    console.warn(`[lending/onchain] ${lenderId} reserve read failed`, error);
    return null;
  }
}

async function readMoonwellUsdcBorrowRate(
  provider: JsonRpcProvider,
  mUsdcAddress: string,
  chainId: number
): Promise<OnChainBorrowQuote | null> {
  try {
    const mToken = new Contract(mUsdcAddress, MTOKEN_ABI, provider);
    const ratePerSecond = (await mToken.borrowRatePerTimestamp()) as bigint;
    const borrowApyBps = perSecondRateToApyBps(ratePerSecond);

    if (borrowApyBps <= 0) {
      return null;
    }

    return {
      lenderId: 'moonwell',
      borrowApyBps,
      source: `onchain:moonwell:${chainId}:usdc`,
      chainId
    };
  } catch (error) {
    console.warn('[lending/onchain] Moonwell borrow rate read failed', error);
    return null;
  }
}

async function readCompoundUsdcBorrowRate(
  provider: JsonRpcProvider,
  cometAddress: string,
  chainId: number
): Promise<OnChainBorrowQuote | null> {
  try {
    const comet = new Contract(cometAddress, COMET_ABI, provider);
    const utilization = (await comet.getUtilization()) as bigint;
    const borrowRatePerSecond = (await comet.getBorrowRate(utilization)) as bigint;
    const borrowApyBps = perSecondRateToApyBps(borrowRatePerSecond);

    if (borrowApyBps <= 0) {
      return null;
    }

    return {
      lenderId: 'compound',
      borrowApyBps,
      source: `onchain:compound-v3:${chainId}:usdc`,
      chainId
    };
  } catch (error) {
    console.warn('[lending/onchain] Compound borrow rate read failed', error);
    return null;
  }
}

/** Reads live USDC borrow rates from configured lending protocols on the active chain. */
export async function fetchOnChainBorrowQuotes(): Promise<Map<string, OnChainBorrowQuote>> {
  if (process.env.LENDING_ONCHAIN_RATES === 'false') {
    return new Map();
  }

  const lendingChainRaw = process.env.LENDING_CHAIN_ID?.trim();
  const chainId =
    lendingChainRaw && Number.isFinite(Number(lendingChainRaw))
      ? Number.parseInt(lendingChainRaw, 10)
      : resolveChainId();

  const config = getLendingChainConfigForChain(chainId);

  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
  const quotes = new Map<string, OnChainBorrowQuote>();

  try {
    const aaveQuote = await readAaveV3UsdcBorrowRate(provider, config.aavePool, config.usdc, 'aave', chainId);
    if (aaveQuote) {
      quotes.set('aave', aaveQuote);
    }

    if (config.spark) {
      const sparkQuote = await readAaveV3UsdcBorrowRate(
        provider,
        config.spark.pool,
        config.spark.usdc,
        'spark',
        chainId
      );
      if (sparkQuote) {
        quotes.set('spark', sparkQuote);
      }
    }

    if (config.moonwell) {
      const moonwellQuote = await readMoonwellUsdcBorrowRate(provider, config.moonwell.mUsdc, chainId);
      if (moonwellQuote) {
        quotes.set('moonwell', moonwellQuote);
      }
    }

    if (config.compound) {
      const compoundQuote = await readCompoundUsdcBorrowRate(provider, config.compound.comet, chainId);
      if (compoundQuote) {
        quotes.set('compound', compoundQuote);
      }
    }

    return quotes;
  } finally {
    provider.destroy();
  }
}
