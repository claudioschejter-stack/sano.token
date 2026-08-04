import { Interface, JsonRpcProvider, formatUnits, getAddress, type Log } from 'ethers';
import { getLendingChainConfig } from './baseContracts';
import { readWithRetry } from '../blockchain/rpcRetry';

/**
 * Find the Morpho market a vault actually belongs to, by asking the chain.
 *
 * Until now the market id was recomputed from assumed parameters — the LLTV
 * from an env var and the oracle from our own records — so a market created
 * with any other combination was invisible: the computed id pointed at a market
 * that does not exist, every read returned zero, and the asset looked illiquid
 * while its liquidity sat untouched. Discovery removes the assumption, which is
 * what makes this reconcilable in bulk instead of one asset at a time.
 */

const MORPHO_EVENTS = new Interface([
  'event CreateMarket(bytes32 indexed id, (address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams)'
]);

const MARKET_ABI = [
  'function market(bytes32) view returns (uint128 totalSupplyAssets,uint128 totalSupplyShares,uint128 totalBorrowAssets,uint128 totalBorrowShares,uint128 lastUpdate,uint128 fee)'
];

/** Morpho Blue's deployment block on Base; nothing relevant exists before it. */
function morphoDeployBlock(): number {
  const raw = process.env.MORPHO_DEPLOY_BLOCK?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 13_977_148;
}

export type DiscoveredMarket = {
  marketId: string;
  collateralToken: string;
  loanToken: string;
  oracle: string;
  irm: string;
  lltv: string;
  supplyAssets: string;
  borrowAssets: string;
  availableAssets: string;
};

const MARKET_PARAMS_ABI = [
  'function idToMarketParams(bytes32) view returns (address loanToken,address collateralToken,address oracle,address irm,uint256 lltv)'
];

export type StoredMarketCheck =
  | { ok: true; market: DiscoveredMarket }
  | { ok: false; reason: 'NOT_FOUND' | 'COLLATERAL_MISMATCH' | 'READ_FAILED'; detail?: string };

/**
 * Verify a market id we already have against the chain.
 *
 * This is the cheap, exact path: two reads, no assumptions about parameters and
 * no event scanning. Scanning only earns its cost when the stored id is missing
 * or points somewhere else.
 */
export async function verifyStoredMarket(input: {
  provider: JsonRpcProvider;
  marketId: string;
  expectedCollateral: string;
  loanDecimals?: number;
}): Promise<StoredMarketCheck> {
  const { Contract } = await import('ethers');
  const morpho = new Contract(
    getLendingChainConfig().morpho,
    [...MARKET_PARAMS_ABI, ...MARKET_ABI],
    input.provider
  );

  const params = await readWithRetry(() => morpho.idToMarketParams(input.marketId));
  if (!params) {
    return { ok: false, reason: 'READ_FAILED' };
  }

  const collateral = String(params.collateralToken ?? params[1] ?? '');
  if (!collateral || collateral === '0x0000000000000000000000000000000000000000') {
    return { ok: false, reason: 'NOT_FOUND' };
  }
  if (collateral.toLowerCase() !== input.expectedCollateral.trim().toLowerCase()) {
    return { ok: false, reason: 'COLLATERAL_MISMATCH', detail: collateral };
  }

  const state = await readWithRetry(() => morpho.market(input.marketId));
  if (!state) {
    return { ok: false, reason: 'READ_FAILED' };
  }

  const decimals = input.loanDecimals ?? 6;
  const supply = BigInt(state[0] ?? 0);
  const borrow = BigInt(state[2] ?? 0);
  const available = supply > borrow ? supply - borrow : 0n;

  return {
    ok: true,
    market: {
      marketId: input.marketId,
      collateralToken: getAddress(collateral),
      loanToken: getAddress(String(params.loanToken ?? params[0])),
      oracle: getAddress(String(params.oracle ?? params[2])),
      irm: getAddress(String(params.irm ?? params[3])),
      lltv: BigInt(params.lltv ?? params[4] ?? 0).toString(),
      supplyAssets: formatUnits(supply, decimals),
      borrowAssets: formatUnits(borrow, decimals),
      availableAssets: formatUnits(available, decimals)
    }
  };
}

/**
 * `scanned: false` means the scan could not be completed, which is not the same
 * as finding nothing — reporting "no market" for a scan that never ran is how a
 * market holding 656 USDC got declared absent.
 */
async function fetchCreateMarketLogs(
  provider: JsonRpcProvider
): Promise<{ scanned: boolean; logs: Log[] }> {
  const morpho = getLendingChainConfig().morpho;
  const topic = MORPHO_EVENTS.getEvent('CreateMarket')!.topicHash;
  const latest = await provider.getBlockNumber();
  const fromBlock = morphoDeployBlock();

  // One wide request works on a dedicated provider; chunk only if it refuses.
  const whole = await readWithRetry(() =>
    provider.getLogs({ address: morpho, topics: [topic], fromBlock, toBlock: latest })
  );
  if (whole) {
    return { scanned: true, logs: whole };
  }

  const logs: Log[] = [];
  const step = 500_000;
  let anyChunkFailed = false;
  for (let start = fromBlock; start <= latest; start += step) {
    const end = Math.min(start + step - 1, latest);
    const chunk = await readWithRetry(() =>
      provider.getLogs({ address: morpho, topics: [topic], fromBlock: start, toBlock: end })
    );
    if (chunk) {
      logs.push(...chunk);
    } else {
      anyChunkFailed = true;
    }
  }
  return { scanned: !anyChunkFailed, logs };
}

/**
 * Every market on Morpho whose collateral is one of `collateralTokens`,
 * with its live liquidity.
 */
export async function discoverMarketsByCollateral(input: {
  provider: JsonRpcProvider;
  collateralTokens: string[];
  /** USDC decimals, for readable amounts. */
  loanDecimals?: number;
}): Promise<{ scanned: boolean; byCollateral: Map<string, DiscoveredMarket[]> }> {
  const wanted = new Set(
    input.collateralTokens
      .map((row) => row?.trim())
      .filter((row): row is string => Boolean(row))
      .map((row) => row.toLowerCase())
  );

  const byCollateral = new Map<string, DiscoveredMarket[]>();
  if (!wanted.size) {
    return { scanned: true, byCollateral };
  }

  const { scanned, logs } = await fetchCreateMarketLogs(input.provider);
  const decimals = input.loanDecimals ?? 6;
  const { Contract } = await import('ethers');
  const morphoContract = new Contract(
    getLendingChainConfig().morpho,
    MARKET_ABI,
    input.provider
  );

  for (const log of logs) {
    let parsed;
    try {
      parsed = MORPHO_EVENTS.parseLog({ topics: [...log.topics], data: log.data });
    } catch {
      continue;
    }
    if (!parsed) continue;

    const params = parsed.args.marketParams as unknown as {
      loanToken: string;
      collateralToken: string;
      oracle: string;
      irm: string;
      lltv: bigint;
    };
    const collateral = params.collateralToken?.toLowerCase();
    if (!collateral || !wanted.has(collateral)) continue;

    const marketId = String(parsed.args.id);
    const state = await readWithRetry(() => morphoContract.market(marketId));
    const supply = state ? BigInt(state[0] ?? 0) : 0n;
    const borrow = state ? BigInt(state[2] ?? 0) : 0n;
    const available = supply > borrow ? supply - borrow : 0n;

    const entry: DiscoveredMarket = {
      marketId,
      collateralToken: getAddress(params.collateralToken),
      loanToken: getAddress(params.loanToken),
      oracle: getAddress(params.oracle),
      irm: getAddress(params.irm),
      lltv: params.lltv.toString(),
      supplyAssets: formatUnits(supply, decimals),
      borrowAssets: formatUnits(borrow, decimals),
      availableAssets: formatUnits(available, decimals)
    };

    const list = byCollateral.get(collateral) ?? [];
    list.push(entry);
    byCollateral.set(collateral, list);
  }

  // The market holding the most liquidity is the one the asset should borrow from.
  for (const [key, list] of byCollateral) {
    list.sort((a, b) => Number(b.availableAssets) - Number(a.availableAssets));
    byCollateral.set(key, list);
  }

  return { scanned, byCollateral };
}
