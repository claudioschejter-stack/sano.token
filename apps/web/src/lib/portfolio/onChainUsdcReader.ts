import { ethers } from 'ethers';
import { baseRpcUrls, getStablecoinNetwork } from '../payments/stablecoinNetworks';

const ERC20_ABI = ['function balanceOf(address account) view returns (uint256)'];

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

async function balanceOfWithProvider(
  rpcUrl: string,
  tokenAddress: string,
  walletAddress: string,
  decimals: number
): Promise<number> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  try {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const raw = (await token.balanceOf(walletAddress)) as bigint;
    const amountUsdc = Number(ethers.formatUnits(raw, decimals));
    if (!Number.isFinite(amountUsdc)) {
      throw new Error('INVALID_BALANCE_AMOUNT');
    }
    return amountUsdc;
  } finally {
    provider.destroy();
  }
}

/**
 * Read USDC balances for a wallet. On RPC failure returns `{ ok: false }` —
 * callers must NOT treat that as a zero balance (that caused checkout UI flicker).
 * Successful zero balances are returned as `{ ok: true, amountUsdc: 0 }`.
 *
 * Tries primary + public Base RPC fallbacks with short retries — public
 * `mainnet.base.org` alone is often rate-limited on Vercel.
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
          networkBalance = await balanceOfWithProvider(
            rpcUrl as string,
            network.tokenAddress,
            checksum,
            network.decimals
          );
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'RPC_BALANCE_READ_FAILED';
          if (attempt === 0) {
            await sleep(150);
          }
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
