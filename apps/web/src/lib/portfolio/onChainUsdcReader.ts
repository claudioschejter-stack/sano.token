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

export async function readWalletUsdcBalances(
  walletAddress: string,
  networks: Array<'BASE'> = ['BASE']
): Promise<WalletUsdcBalance[]> {
  if (!walletAddress?.trim()) {
    return [];
  }

  const balances: WalletUsdcBalance[] = [];

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

        if (amountUsdc > 0) {
          balances.push({
            walletAddress: ethers.getAddress(walletAddress.trim()),
            chainId: network.chainId ?? 8453,
            network: networkKey,
            symbol: network.symbol ?? 'USDC',
            amountUsdc
          });
        }
      } catch (error) {
        console.error('[readWalletUsdcBalances]', networkKey, error);
      }
    })
  );

  return balances;
}
