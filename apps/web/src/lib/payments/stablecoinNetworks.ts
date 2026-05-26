export type StablecoinNetworkId = 'BASE' | 'POLYGON' | 'TRON' | 'SOLANA';

export type StablecoinNetwork = {
  id: StablecoinNetworkId;
  label: string;
  kind: 'EVM' | 'TRON' | 'SOLANA';
  chainId: number | null;
  symbol: 'USDC' | 'USDT';
  decimals: number;
  tokenAddress: string | null;
  treasuryAddress: string | null;
  rpcUrl: string | null;
  cheapestRank: number;
};

export const DEFAULT_STABLECOIN_NETWORK: StablecoinNetworkId = 'BASE';

export function stablecoinNetworks(): StablecoinNetwork[] {
  const sharedTreasury =
    process.env.STABLECOIN_TREASURY_ADDRESS?.trim() ||
    process.env.TOKEN_TREASURY_ADDRESS?.trim() ||
    process.env.SANOVA_TREASURY_ADDRESS?.trim() ||
    null;

  return [
    {
      id: 'BASE',
      label: 'USDC en Base',
      kind: 'EVM',
      chainId: envNumber('BASE_STABLECOIN_CHAIN_ID', envNumber('STABLECOIN_CHAIN_ID', 8453)),
      symbol: 'USDC',
      decimals: envNumber('BASE_USDC_DECIMALS', envNumber('USDC_DECIMALS', 6)),
      tokenAddress: envString('BASE_USDC_TOKEN_ADDRESS') || envString('USDC_TOKEN_ADDRESS'),
      treasuryAddress: envString('BASE_STABLECOIN_TREASURY_ADDRESS') || sharedTreasury,
      rpcUrl: envString('BASE_RPC_URL') || 'https://mainnet.base.org',
      cheapestRank: 1
    },
    {
      id: 'POLYGON',
      label: 'USDC en Polygon',
      kind: 'EVM',
      chainId: envNumber('POLYGON_STABLECOIN_CHAIN_ID', 137),
      symbol: 'USDC',
      decimals: envNumber('POLYGON_USDC_DECIMALS', 6),
      tokenAddress: envString('POLYGON_USDC_TOKEN_ADDRESS'),
      treasuryAddress: envString('POLYGON_STABLECOIN_TREASURY_ADDRESS') || sharedTreasury,
      rpcUrl: envString('POLYGON_RPC_URL') || 'https://polygon-rpc.com',
      cheapestRank: 2
    },
    {
      id: 'SOLANA',
      label: 'USDC en Solana',
      kind: 'SOLANA',
      chainId: null,
      symbol: 'USDC',
      decimals: envNumber('SOLANA_USDC_DECIMALS', 6),
      tokenAddress: envString('SOLANA_USDC_MINT_ADDRESS'),
      treasuryAddress: envString('SOLANA_STABLECOIN_TREASURY_ADDRESS'),
      rpcUrl: envString('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com',
      cheapestRank: 3
    },
    {
      id: 'TRON',
      label: 'USDT en TRON',
      kind: 'TRON',
      chainId: null,
      symbol: 'USDT',
      decimals: envNumber('TRON_USDT_DECIMALS', 6),
      tokenAddress: envString('TRON_USDT_TOKEN_ADDRESS'),
      treasuryAddress: envString('TRON_STABLECOIN_TREASURY_ADDRESS'),
      rpcUrl: envString('TRON_GRID_API_URL') || 'https://api.trongrid.io',
      cheapestRank: 4
    }
  ];
}

export function getStablecoinNetwork(id?: string | null): StablecoinNetwork {
  const normalized = (id?.trim().toUpperCase() || process.env.STABLECOIN_DEFAULT_NETWORK || DEFAULT_STABLECOIN_NETWORK) as StablecoinNetworkId;
  return stablecoinNetworks().find((network) => network.id === normalized) ?? stablecoinNetworks()[0];
}

export function enabledStablecoinNetworks(): StablecoinNetwork[] {
  const allow = process.env.STABLECOIN_ENABLED_NETWORKS?.trim();
  const networks = stablecoinNetworks().filter((network) => Boolean(network.tokenAddress && network.treasuryAddress));
  if (!allow) {
    return networks;
  }

  const allowed = new Set(allow.split(',').map((item) => item.trim().toUpperCase()));
  return networks.filter((network) => allowed.has(network.id));
}

function envString(name: string): string | null {
  return process.env[name]?.trim() || null;
}

function envNumber(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
}
