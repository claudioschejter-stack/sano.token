/**
 * Chain registry — Base mainnet only (Morpho Blue collateral + USDC borrow).
 */
import { resolveBaseMainnetRpcUrl } from './baseRpc';

export const BASE_MAINNET_CHAIN_ID = 8453;

export type SupportedChainKey = 'base';

export type ChainDefinition = {
  id: number;
  key: SupportedChainKey;
  name: string;
  nativeSymbol: string;
  defaultRpcUrl: string;
  explorerBaseUrl: string;
  morphoSupported: boolean;
};

export const CHAIN_DEFINITIONS: Record<number, ChainDefinition> = {
  [BASE_MAINNET_CHAIN_ID]: {
    id: BASE_MAINNET_CHAIN_ID,
    key: 'base',
    name: 'Base',
    nativeSymbol: 'ETH',
    defaultRpcUrl: 'https://mainnet.base.org',
    explorerBaseUrl: 'https://basescan.org',
    morphoSupported: true
  }
};

export function getChainDefinition(chainId: number): ChainDefinition | null {
  return CHAIN_DEFINITIONS[chainId] ?? null;
}

export function isMorphoSupportedChain(chainId: number): boolean {
  return chainId === BASE_MAINNET_CHAIN_ID;
}

/**
 * Base only, so the chain id does not change the answer. Delegates to the single
 * resolver: reading just `BASE_RPC_URL` here meant the RWA security report ran
 * on the throttled public endpoint whenever the dedicated one was configured
 * under another name, and a throttled read looks exactly like a contract saying
 * "no".
 */
export function resolveChainRpcUrl(_chainId: number): string {
  return resolveBaseMainnetRpcUrl();
}

export function chainExplorerAddressUrl(chainId: number, address: string): string {
  const def = CHAIN_DEFINITIONS[chainId];
  if (!def) {
    return address;
  }
  return `${def.explorerBaseUrl}/address/${address}`;
}
