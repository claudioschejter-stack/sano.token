export type StablecoinNetworkId = 'BASE';

export type StablecoinNetwork = {
  id: StablecoinNetworkId;
  label: string;
  kind: 'EVM';
  chainId: number;
  symbol: 'USDC';
  decimals: number;
  tokenAddress: string | null;
  treasuryAddress: string | null;
  rpcUrl: string | null;
  cheapestRank: number;
};

export const DEFAULT_STABLECOIN_NETWORK: StablecoinNetworkId = 'BASE';

/** Canonical Base mainnet USDC — used when env is missing so server balance/settle cannot silently fail. */
export const DEFAULT_BASE_USDC_TOKEN_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const BASE_RPC_FALLBACKS = [
  'https://mainnet.base.org',
  'https://base.publicnode.com',
  'https://base.llamarpc.com',
  'https://1rpc.io/base'
] as const;

export function baseRpcUrls(): string[] {
  const primary =
    envString('BASE_RPC_URL') ||
    envString('NEXT_PUBLIC_BASE_RPC_URL') ||
    envString('LENDING_BASE_RPC_URL');
  const urls = [primary, ...BASE_RPC_FALLBACKS].filter((url): url is string => Boolean(url));
  return [...new Set(urls)];
}

export function stablecoinNetworks(): StablecoinNetwork[] {
  const sharedTreasury =
    process.env.STABLECOIN_TREASURY_ADDRESS?.trim() ||
    process.env.TOKEN_TREASURY_ADDRESS?.trim() ||
    process.env.SANOVA_TREASURY_ADDRESS?.trim() ||
    null;

  const rpcUrls = baseRpcUrls();

  return [
    {
      id: 'BASE',
      label: 'USDC en Base',
      kind: 'EVM',
      chainId: envNumber('BASE_STABLECOIN_CHAIN_ID', envNumber('STABLECOIN_CHAIN_ID', 8453)),
      symbol: 'USDC',
      decimals: envNumber('BASE_USDC_DECIMALS', envNumber('USDC_DECIMALS', 6)),
      tokenAddress:
        envString('BASE_USDC_TOKEN_ADDRESS') ||
        envString('USDC_TOKEN_ADDRESS') ||
        envString('NEXT_PUBLIC_BASE_USDC_ADDRESS') ||
        DEFAULT_BASE_USDC_TOKEN_ADDRESS,
      treasuryAddress: envString('BASE_STABLECOIN_TREASURY_ADDRESS') || sharedTreasury,
      rpcUrl: rpcUrls[0] ?? 'https://mainnet.base.org',
      cheapestRank: 1
    }
  ];
}

export function getStablecoinNetwork(id?: string | null): StablecoinNetwork {
  const normalized = (id?.trim().toUpperCase() || process.env.STABLECOIN_DEFAULT_NETWORK || DEFAULT_STABLECOIN_NETWORK) as StablecoinNetworkId;
  return stablecoinNetworks().find((network) => network.id === normalized) ?? stablecoinNetworks()[0];
}

/** On-chain investor flows only support Base USDC. */
export function requireBaseStablecoinNetwork(id?: string | null): StablecoinNetwork {
  const network = getStablecoinNetwork(id);
  if (network.id !== 'BASE') {
    throw new Error('CHAIN_MISMATCH');
  }
  return network;
}

export function enabledStablecoinNetworks(): StablecoinNetwork[] {
  return stablecoinNetworks().filter((network) => Boolean(network.tokenAddress && network.treasuryAddress));
}

function envString(name: string): string | null {
  return process.env[name]?.trim() || null;
}

function envNumber(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
}
