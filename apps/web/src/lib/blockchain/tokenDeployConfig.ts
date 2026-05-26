import { JsonRpcProvider, Wallet } from 'ethers';
import { resolveChainId } from './explorerUrls';

export function isSanovaTokenDeployConfigured(): boolean {
  const privateKey = (process.env.TOKEN_DEPLOY_PRIVATE_KEY ?? process.env.PRIVATE_KEY)?.trim();
  const rpcUrl = (process.env.BASE_RPC_URL ?? process.env.POLYGON_RPC_URL)?.trim();
  return Boolean(privateKey && rpcUrl);
}

function resolveRpcUrl(chainId: number): string | null {
  if (chainId === 84532 || chainId === 8453) {
    return process.env.BASE_RPC_URL?.trim() || (chainId === 84532 ? 'https://sepolia.base.org' : 'https://mainnet.base.org');
  }

  if (chainId === 80002 || chainId === 137) {
    return process.env.POLYGON_RPC_URL?.trim() || (chainId === 80002 ? 'https://rpc-amoy.polygon.technology' : 'https://polygon-rpc.com');
  }

  if (chainId === 11155111) {
    return process.env.ETHEREUM_RPC_URL?.trim() || 'https://rpc.sepolia.org';
  }

  return process.env.BASE_RPC_URL?.trim() || null;
}

export async function getTokenDeployStatus() {
  const privateKey = (process.env.TOKEN_DEPLOY_PRIVATE_KEY ?? process.env.PRIVATE_KEY)?.trim();
  const thirdweb = process.env.THIRDWEB_SECRET_KEY?.trim();
  const chainId = resolveChainId();
  const rpcUrl = resolveRpcUrl(chainId);
  let deployerAddress: string | null = null;
  let gasBalanceWei: string | null = null;
  let hasGas = false;
  let gasCheckError: string | null = null;

  if (privateKey && rpcUrl) {
    const provider = new JsonRpcProvider(rpcUrl);
    try {
      const wallet = new Wallet(privateKey, provider);
      deployerAddress = wallet.address;
      const balance = await provider.getBalance(wallet.address);
      gasBalanceWei = balance.toString();
      hasGas = balance > 0n;
    } catch (error) {
      gasCheckError = error instanceof Error ? error.message : 'Gas check failed';
    } finally {
      provider.destroy();
    }
  }

  const sanovaDirect = isSanovaTokenDeployConfigured() && hasGas;

  return {
    configured: sanovaDirect || Boolean(thirdweb && privateKey && hasGas),
    sanovaDirect,
    thirdweb: Boolean(thirdweb && privateKey),
    chainId,
    autoDeployDefault: sanovaDirect,
    deployerAddress,
    hasGas,
    gasBalanceWei,
    gasCheckError
  };
}
