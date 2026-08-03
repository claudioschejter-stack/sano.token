import { Interface, JsonRpcProvider, formatEther, parseUnits } from 'ethers';
import {
  DEFAULT_BASE_USDC_TOKEN_ADDRESS,
  baseRpcUrls,
  getStablecoinNetwork
} from './stablecoinNetworks';

export type GasQuoteTx = {
  to: string;
  data?: string;
  value?: string;
};

export type BaseUserPaysGasQuote = {
  /** Live network gas cost converted to USD (USDC-equivalent), after paymaster buffer. */
  networkFeeUsd: number;
  /** Raw network fee before buffer. */
  networkFeeUsdRaw: number;
  gasUnits: number;
  ethUsd: number;
  feeWei: bigint;
  txCount: number;
  quotedAt: string;
};

const ERC20_TRANSFER_IFACE = new Interface([
  'function transfer(address to, uint256 amount) returns (bool)'
]);

const FALLBACK_GAS_PER_TX = 85_000n;
const ETH_USD_CACHE_TTL_MS = 60_000;

let ethUsdCache: { value: number; at: number } | null = null;

function bufferBps(): number {
  const raw = Number(process.env.PRIVY_USER_PAYS_GAS_BUFFER_BPS ?? '1500');
  if (!Number.isFinite(raw) || raw < 0) return 1500;
  return Math.min(10_000, Math.floor(raw));
}

function roundUsdc(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

async function rpcCall<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store'
  });
  if (!response.ok) {
    throw new Error(`BASE_RPC_HTTP_${response.status}`);
  }
  const payload = (await response.json()) as { result?: T; error?: { message?: string } };
  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }
  if (payload.result === undefined) {
    throw new Error('BASE_RPC_EMPTY_RESULT');
  }
  return payload.result;
}

async function withBaseRpc<T>(run: (url: string) => Promise<T>): Promise<T> {
  const urls = baseRpcUrls();
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      return await run(url);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('BASE_RPC_UNAVAILABLE');
}

/** ETH/USD for converting Base gas (ETH) into USDC-equivalent display units. */
export async function fetchEthUsdPrice(): Promise<number> {
  const envPrice = Number(process.env.ETH_USD_PRICE ?? process.env.BASE_ETH_USD_PRICE ?? '');
  if (Number.isFinite(envPrice) && envPrice > 0) {
    return envPrice;
  }

  const now = Date.now();
  if (ethUsdCache && now - ethUsdCache.at < ETH_USD_CACHE_TTL_MS) {
    return ethUsdCache.value;
  }

  const response = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
    { cache: 'no-store' }
  );
  if (!response.ok) {
    throw new Error(`ETH_USD_PRICE_HTTP_${response.status}`);
  }
  const payload = (await response.json()) as { ethereum?: { usd?: number } };
  const value = Number(payload.ethereum?.usd);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('ETH_USD_PRICE_INVALID');
  }
  ethUsdCache = { value, at: now };
  return value;
}

async function estimateGasUnits(url: string, tx: GasQuoteTx, from: string): Promise<bigint> {
  try {
    const hex = await rpcCall<string>(url, 'eth_estimateGas', [
      {
        from,
        to: tx.to,
        data: tx.data?.trim() || '0x',
        value: tx.value && tx.value !== '0' ? tx.value : undefined
      }
    ]);
    const gas = BigInt(hex);
    if (gas > 0n) {
      // Small headroom — Privy/Alchemy paymaster quotes max fee, not bare estimate.
      return (gas * 120n) / 100n;
    }
  } catch {
    // fall through
  }
  return FALLBACK_GAS_PER_TX;
}

async function readFeePerGasWei(url: string): Promise<bigint> {
  try {
    const hex = await rpcCall<string>(url, 'eth_gasPrice', []);
    const gasPrice = BigInt(hex);
    if (gasPrice > 0n) {
      return gasPrice;
    }
  } catch {
    // fall through to provider fee data
  }

  const provider = new JsonRpcProvider(url);
  try {
    const fee = await provider.getFeeData();
    const candidate = fee.gasPrice ?? fee.maxFeePerGas ?? 0n;
    if (candidate > 0n) return candidate;
  } finally {
    provider.destroy();
  }
  // ~0.01 gwei fallback — Base is cheap; never return 0 (would hide gas in UI).
  return 10_000_000n;
}

/**
 * Live Base gas quote for Privy User pays (USDC): network fee in USD/USDC terms.
 * Applies PRIVY_USER_PAYS_GAS_BUFFER_BPS (default 15%) for Alchemy paymaster convenience fee.
 */
export async function quoteBaseUserPaysGasUsd(input: {
  transactions: GasQuoteTx[];
  fromAddress?: string | null;
}): Promise<BaseUserPaysGasQuote> {
  const txs = input.transactions.filter((tx) => Boolean(tx.to?.trim()));
  if (!txs.length) {
    throw new Error('GAS_QUOTE_TXS_REQUIRED');
  }

  const network = getStablecoinNetwork('BASE');
  const from =
    input.fromAddress?.trim() ||
    network.treasuryAddress?.trim() ||
    '0x0000000000000000000000000000000000000001';

  const { gasUnits, feeWei } = await withBaseRpc(async (url) => {
    let totalGas = 0n;
    for (const tx of txs) {
      totalGas += await estimateGasUnits(url, tx, from);
    }
    const feePerGas = await readFeePerGasWei(url);
    return { gasUnits: totalGas, feeWei: totalGas * feePerGas };
  });

  const ethUsd = await fetchEthUsdPrice();
  const ethAmount = Number(formatEther(feeWei));
  const networkFeeUsdRaw = roundUsdc(ethAmount * ethUsd);
  const networkFeeUsd = roundUsdc(networkFeeUsdRaw * (1 + bufferBps() / 10_000));

  return {
    networkFeeUsd: Math.max(networkFeeUsd, 0.000001),
    networkFeeUsdRaw: Math.max(networkFeeUsdRaw, 0),
    gasUnits: Number(gasUnits),
    ethUsd,
    feeWei,
    txCount: txs.length,
    quotedAt: new Date().toISOString()
  };
}

/** Checkout lane quote before we know vault vs treasury — models a typical USDC transfer. */
export async function quoteBaseCryptoCheckoutGasUsd(input: {
  amountUsd: number;
  fromAddress?: string | null;
  /** Vault carts need approve+deposit; treasury needs one transfer. Default assumes transfer. */
  path?: 'transfer' | 'vault';
}): Promise<BaseUserPaysGasQuote> {
  const network = getStablecoinNetwork('BASE');
  const token = network.tokenAddress || DEFAULT_BASE_USDC_TOKEN_ADDRESS;
  const treasury = network.treasuryAddress || '0x0000000000000000000000000000000000000002';
  const amount = parseUnits(Math.max(input.amountUsd, 0.01).toFixed(network.decimals), network.decimals);
  const transferData = ERC20_TRANSFER_IFACE.encodeFunctionData('transfer', [treasury, amount]);

  if (input.path === 'vault') {
    // Approximate approve + deposit calldata cost without a specific vault address.
    return quoteBaseUserPaysGasUsd({
      fromAddress: input.fromAddress,
      transactions: [
        { to: token, data: transferData, value: '0' },
        { to: treasury, data: transferData, value: '0' }
      ]
    });
  }

  return quoteBaseUserPaysGasUsd({
    fromAddress: input.fromAddress,
    transactions: [{ to: token, data: transferData, value: '0' }]
  });
}
