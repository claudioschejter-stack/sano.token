import { chainExplorerAddressUrl, resolveChainRpcUrl } from './supportedChains';

export { resolveChainRpcUrl };

export function resolveChainId(): number {
  const raw = process.env.TOKEN_DEPLOY_CHAIN_ID ?? process.env.NEXT_PUBLIC_CHAIN_ID ?? '8453';
  return Number.parseInt(raw, 10);
}

/** Chain for Morpho borrow markets (defaults to Base mainnet in production). */
export function resolveMorphoChainId(): number {
  const raw =
    process.env.MORPHO_CHAIN_ID?.trim() ||
    process.env.LENDING_CHAIN_ID?.trim() ||
    process.env.TOKEN_DEPLOY_CHAIN_ID?.trim() ||
    '8453';
  return Number.parseInt(raw, 10);
}

export function explorerUrl(chainId: number, address: string): string {
  return chainExplorerAddressUrl(chainId, address);
}

export function buildSmartContractDocUrl(chainId: number | null, contractAddress: string | null): string | null {
  if (!contractAddress) {
    return null;
  }

  return explorerUrl(chainId ?? resolveChainId(), contractAddress);
}
