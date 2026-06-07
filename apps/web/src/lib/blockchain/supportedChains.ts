/**
 * Chain registry for token deploy, Morpho collateral, and wallet connectivity.
 * Plume (98866/98867) is the RWA-native L1 linked for async vault (ERC-7540) issuance.
 */

export const PLUME_MAINNET_CHAIN_ID = 98866;
export const PLUME_TESTNET_CHAIN_ID = 98867;

export type SupportedChainKey =
  | 'base'
  | 'baseSepolia'
  | 'polygon'
  | 'polygonAmoy'
  | 'ethereum'
  | 'sepolia'
  | 'plume'
  | 'plumeTestnet';

export type ChainDefinition = {
  id: number;
  key: SupportedChainKey;
  name: string;
  nativeSymbol: string;
  defaultRpcUrl: string;
  explorerBaseUrl: string;
  /** Whether Morpho Blue is listed for this chain in Morpho docs. */
  morphoSupported: boolean;
};

export const CHAIN_DEFINITIONS: Record<number, ChainDefinition> = {
  8453: {
    id: 8453,
    key: 'base',
    name: 'Base',
    nativeSymbol: 'ETH',
    defaultRpcUrl: 'https://mainnet.base.org',
    explorerBaseUrl: 'https://basescan.org',
    morphoSupported: true
  },
  84532: {
    id: 84532,
    key: 'baseSepolia',
    name: 'Base Sepolia',
    nativeSymbol: 'ETH',
    defaultRpcUrl: 'https://sepolia.base.org',
    explorerBaseUrl: 'https://sepolia.basescan.org',
    morphoSupported: true
  },
  137: {
    id: 137,
    key: 'polygon',
    name: 'Polygon',
    nativeSymbol: 'POL',
    defaultRpcUrl: 'https://polygon-rpc.com',
    explorerBaseUrl: 'https://polygonscan.com',
    morphoSupported: true
  },
  80002: {
    id: 80002,
    key: 'polygonAmoy',
    name: 'Polygon Amoy',
    nativeSymbol: 'POL',
    defaultRpcUrl: 'https://rpc-amoy.polygon.technology',
    explorerBaseUrl: 'https://amoy.polygonscan.com',
    morphoSupported: false
  },
  1: {
    id: 1,
    key: 'ethereum',
    name: 'Ethereum',
    nativeSymbol: 'ETH',
    defaultRpcUrl: 'https://ethereum-rpc.publicnode.com',
    explorerBaseUrl: 'https://etherscan.io',
    morphoSupported: true
  },
  11155111: {
    id: 11155111,
    key: 'sepolia',
    name: 'Sepolia',
    nativeSymbol: 'ETH',
    defaultRpcUrl: 'https://rpc.sepolia.org',
    explorerBaseUrl: 'https://sepolia.etherscan.io',
    morphoSupported: true
  },
  [PLUME_MAINNET_CHAIN_ID]: {
    id: PLUME_MAINNET_CHAIN_ID,
    key: 'plume',
    name: 'Plume',
    nativeSymbol: 'PLUME',
    defaultRpcUrl: 'https://rpc.plume.org',
    explorerBaseUrl: 'https://explorer.plume.org',
    morphoSupported: true
  },
  [PLUME_TESTNET_CHAIN_ID]: {
    id: PLUME_TESTNET_CHAIN_ID,
    key: 'plumeTestnet',
    name: 'Plume Testnet',
    nativeSymbol: 'PLUME',
    defaultRpcUrl: 'https://testnet-rpc.plume.org',
    explorerBaseUrl: 'https://testnet-explorer.plume.org',
    morphoSupported: false
  }
};

export function getChainDefinition(chainId: number): ChainDefinition | null {
  return CHAIN_DEFINITIONS[chainId] ?? null;
}

export function isMorphoSupportedChain(chainId: number): boolean {
  return CHAIN_DEFINITIONS[chainId]?.morphoSupported ?? false;
}

export function isPlumeChain(chainId: number): boolean {
  return chainId === PLUME_MAINNET_CHAIN_ID || chainId === PLUME_TESTNET_CHAIN_ID;
}

/** Resolves RPC URL for deploy, Morpho, and on-chain reads. */
export function resolveChainRpcUrl(chainId: number): string {
  if (chainId === PLUME_MAINNET_CHAIN_ID || chainId === PLUME_TESTNET_CHAIN_ID) {
    return (
      process.env.PLUME_RPC_URL?.trim() ||
      CHAIN_DEFINITIONS[chainId]?.defaultRpcUrl ||
      'https://rpc.plume.org'
    );
  }

  if (chainId === 84532 || chainId === 8453) {
    return (
      process.env.BASE_RPC_URL?.trim() ||
      CHAIN_DEFINITIONS[chainId]?.defaultRpcUrl ||
      'https://mainnet.base.org'
    );
  }

  if (chainId === 80002 || chainId === 137) {
    return (
      process.env.POLYGON_RPC_URL?.trim() ||
      CHAIN_DEFINITIONS[chainId]?.defaultRpcUrl ||
      'https://polygon-rpc.com'
    );
  }

  if (chainId === 11155111 || chainId === 1) {
    return (
      process.env.ETHEREUM_RPC_URL?.trim() ||
      CHAIN_DEFINITIONS[chainId]?.defaultRpcUrl ||
      'https://ethereum-rpc.publicnode.com'
    );
  }

  return process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
}

export function chainExplorerAddressUrl(chainId: number, address: string): string {
  const def = CHAIN_DEFINITIONS[chainId];
  if (!def) {
    return address;
  }
  return `${def.explorerBaseUrl}/address/${address}`;
}

export function isPlumeWalletEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_PLUME_ENABLED === 'true' ||
    process.env.NEXT_PUBLIC_CHAIN_ID === String(PLUME_MAINNET_CHAIN_ID) ||
    process.env.TOKEN_DEPLOY_CHAIN_ID === String(PLUME_MAINNET_CHAIN_ID)
  );
}
