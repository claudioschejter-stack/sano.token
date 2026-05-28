export function resolveChainId(): number {
  const raw = process.env.TOKEN_DEPLOY_CHAIN_ID ?? process.env.NEXT_PUBLIC_CHAIN_ID ?? '84532';
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
  if (chainId === 84532) {
    return `https://sepolia.basescan.org/address/${address}`;
  }

  if (chainId === 80002) {
    return `https://amoy.polygonscan.com/address/${address}`;
  }

  if (chainId === 11155111) {
    return `https://sepolia.etherscan.io/address/${address}`;
  }

  if (chainId === 8453) {
    return `https://basescan.org/address/${address}`;
  }

  if (chainId === 137) {
    return `https://polygonscan.com/address/${address}`;
  }

  return address;
}

export function buildSmartContractDocUrl(chainId: number | null, contractAddress: string | null): string | null {
  if (!contractAddress) {
    return null;
  }

  return explorerUrl(chainId ?? resolveChainId(), contractAddress);
}
