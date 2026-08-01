import { ethers } from 'ethers';
import { baseRpcUrls, getStablecoinNetwork } from '../payments/stablecoinNetworks';

export type WalletUsdcBalance = {
  walletAddress: string;
  chainId: number;
  network: string;
  symbol: string;
  amountUsdc: number;
};

export type ReadWalletUsdcBalanceResult =
  | { ok: true; amountUsdc: number; balances: WalletUsdcBalance[] }
  | { ok: false; amountUsdc: null; balances: []; error: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function balanceOfCallData(walletAddress: string): string {
  const checksum = ethers.getAddress(walletAddress.trim()).slice(2).toLowerCase();
  return `0x70a08231${checksum.padStart(64, '0')}`;
}

/**
 * Raw JSON-RPC eth_call — avoids ethers JsonRpcProvider network detection,
 * which frequently flakes / times out on Vercel serverless.
 */
async function ethCallBalanceOf(
  rpcUrl: string,
  tokenAddress: string,
  walletAddress: string,
  decimals: number
): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [
          {
            to: tokenAddress,
            data: balanceOfCallData(walletAddress)
          },
          'latest'
        ]
      }),
      signal: controller.signal,
      cache: 'no-store'
    });

    const text = await response.text();
    let payload: { result?: string; error?: { message?: string } };
    try {
      payload = JSON.parse(text) as { result?: string; error?: { message?: string } };
    } catch {
      throw new Error(`RPC_NON_JSON:${response.status}`);
    }

    if (!response.ok || payload.error || typeof payload.result !== 'string') {
      throw new Error(payload.error?.message || `RPC_HTTP_${response.status}`);
    }

    const amountUsdc = Number(ethers.formatUnits(BigInt(payload.result), decimals));
    if (!Number.isFinite(amountUsdc)) {
      throw new Error('INVALID_BALANCE_AMOUNT');
    }
    return amountUsdc;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read USDC balances for a wallet. On RPC failure returns `{ ok: false }` —
 * callers must NOT treat that as a zero balance (that caused checkout UI flicker).
 * Successful zero balances are returned as `{ ok: true, amountUsdc: 0 }`.
 */
export async function readWalletUsdcBalances(
  walletAddress: string,
  networks: Array<'BASE'> = ['BASE']
): Promise<WalletUsdcBalance[]> {
  const result = await readWalletUsdcBalanceDetailed(walletAddress, networks);
  return result.balances;
}

export async function readWalletUsdcBalanceDetailed(
  walletAddress: string,
  networks: Array<'BASE'> = ['BASE']
): Promise<ReadWalletUsdcBalanceResult> {
  if (!walletAddress?.trim()) {
    return { ok: true, amountUsdc: 0, balances: [] };
  }

  const balances: WalletUsdcBalance[] = [];
  let sawSuccess = false;
  let lastError: string | null = null;
  const checksum = ethers.getAddress(walletAddress.trim());

  for (const networkKey of networks) {
    const network = getStablecoinNetwork(networkKey);
    if (!network.tokenAddress) {
      lastError = 'USDC_TOKEN_NOT_CONFIGURED';
      continue;
    }

    const rpcCandidates = networkKey === 'BASE' ? baseRpcUrls() : [network.rpcUrl].filter(Boolean);
    if (rpcCandidates.length === 0) {
      lastError = 'RPC_URL_NOT_CONFIGURED';
      continue;
    }

    let networkBalance: number | null = null;

    for (const rpcUrl of rpcCandidates) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          networkBalance = await ethCallBalanceOf(
            rpcUrl as string,
            network.tokenAddress,
            checksum,
            network.decimals
          );
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'RPC_BALANCE_READ_FAILED';
          if (attempt === 0) await sleep(120);
        }
      }
      if (networkBalance != null) break;
    }

    if (networkBalance == null) {
      console.error('[readWalletUsdcBalances] all RPC candidates failed', networkKey, lastError);
      continue;
    }

    sawSuccess = true;
    balances.push({
      walletAddress: checksum,
      chainId: network.chainId ?? 8453,
      network: networkKey,
      symbol: network.symbol ?? 'USDC',
      amountUsdc: networkBalance
    });
  }

  if (!sawSuccess) {
    return {
      ok: false,
      amountUsdc: null,
      balances: [],
      error: lastError ?? 'RPC_BALANCE_READ_FAILED'
    };
  }

  const amountUsdc = balances.reduce((sum, row) => sum + row.amountUsdc, 0);
  return { ok: true, amountUsdc, balances };
}
