import { JsonRpcProvider } from 'ethers';
import { resolveChainId, resolveChainRpcUrl } from './explorerUrls';
import { isPrivyOperatorConfigured } from '../privy/config';
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
  const usesPrivyOperator = isPrivyOperatorConfigured();
  let gasBalanceWei: string | null = null;
  let onChainHasGas = false;
  let gasCheckError: string | null = null;

  if (deployerAddress && rpcUrl) {
    const provider = new JsonRpcProvider(rpcUrl);
    try {
      const balance = await provider.getBalance(deployerAddress);
      gasBalanceWei = balance.toString();
      onChainHasGas = balance > 0n;

      if (usesPrivyOperator) {
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

  /** Privy server wallets can deploy with sponsored gas (Dashboard → Gas). */
  const hasGas = onChainHasGas || usesPrivyOperator;
  const operatorReady = isRwaOperatorConfigured() && Boolean(rpcUrl) && Boolean(deployerAddress);
  const sanovaDirect = operatorReady && hasGas && !gasCheckError;

  return {
    configured: sanovaDirect || Boolean(thirdweb && deployerAddress && hasGas),
    sanovaDirect,
    thirdweb: Boolean(thirdweb && deployerAddress),
    chainId,
    autoDeployDefault: sanovaDirect,
    deployerAddress,
    hasGas,
    onChainHasGas,
    gasBalanceWei,
    gasCheckError,
    usesPrivyOperator,
    privyGasSponsored: usesPrivyOperator && !onChainHasGas
  };
}
