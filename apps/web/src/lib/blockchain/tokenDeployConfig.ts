import { JsonRpcProvider } from 'ethers';
import { resolveChainId, resolveChainRpcUrl } from './explorerUrls';
import {
  isRwaOperatorConfigured,
  resolveRwaOperatorAddress,
  resolveRwaOperatorSigner
} from './rwaOperatorSigner';

export function isSanovaTokenDeployConfigured(): boolean {
  const rpcUrl = process.env.BASE_RPC_URL?.trim();
  return Boolean(isRwaOperatorConfigured() && rpcUrl);
}

export async function getTokenDeployStatus() {
  const thirdweb = process.env.THIRDWEB_SECRET_KEY?.trim();
  const chainId = resolveChainId();
  const rpcUrl = resolveChainRpcUrl(chainId);
  const deployerAddress = resolveRwaOperatorAddress();
  let gasBalanceWei: string | null = null;
  let hasGas = false;
  let gasCheckError: string | null = null;

  if (deployerAddress && rpcUrl) {
    const provider = new JsonRpcProvider(rpcUrl);
    try {
      const balance = await provider.getBalance(deployerAddress);
      gasBalanceWei = balance.toString();
      hasGas = balance > 0n;

      if (isRwaOperatorConfigured()) {
        const signer = await resolveRwaOperatorSigner(provider, chainId);
        if (signer && (await signer.getAddress()).toLowerCase() !== deployerAddress.toLowerCase()) {
          gasCheckError = 'RWA_OPERATOR_ADDRESS no coincide con el firmante configurado.';
        }
      }
    } catch (error) {
      gasCheckError = error instanceof Error ? error.message : 'Gas check failed';
    } finally {
      provider.destroy();
    }
  }

  const sanovaDirect = isSanovaTokenDeployConfigured() && hasGas;

  return {
    configured: sanovaDirect || Boolean(thirdweb && deployerAddress && hasGas),
    sanovaDirect,
    thirdweb: Boolean(thirdweb && deployerAddress),
    chainId,
    autoDeployDefault: sanovaDirect,
    deployerAddress,
    hasGas,
    gasBalanceWei,
    gasCheckError,
    usesPrivyOperator: Boolean(process.env.PRIVY_OPERATOR_WALLET_ID?.trim())
  };
}
