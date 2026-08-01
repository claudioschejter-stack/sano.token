import { ethers } from 'ethers';
import { getStablecoinNetwork } from '../payments/stablecoinNetworks';

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

  await Promise.all(
    networks.map(async (networkKey) => {
      const network = getStablecoinNetwork(networkKey);
      if (!network.rpcUrl || !network.tokenAddress) {
        return;
      }

      try {
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);
        const token = new ethers.Contract(network.tokenAddress, ERC20_ABI, provider);
        const raw = (await token.balanceOf(walletAddress.trim())) as bigint;
        const amountUsdc = Number(ethers.formatUnits(raw, network.decimals));
        sawSuccess = true;

        balances.push({
          walletAddress: ethers.getAddress(walletAddress.trim()),
          chainId: network.chainId ?? 8453,
          network: networkKey,
          symbol: network.symbol ?? 'USDC',
          amountUsdc: Number.isFinite(amountUsdc) ? amountUsdc : 0
        });
        provider.destroy();
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'RPC_BALANCE_READ_FAILED';
        console.error('[readWalletUsdcBalances]', networkKey, error);
      }
    })
  );

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
