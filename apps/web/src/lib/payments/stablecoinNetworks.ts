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
