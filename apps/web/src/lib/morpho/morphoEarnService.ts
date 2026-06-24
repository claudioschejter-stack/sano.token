/**
 * Fetches yield vault data from the Morpho Blue public API.
 * No API key required — publicly available on-chain data.
 *
 * Morpho Blue API: https://blue-api.morpho.org/graphql
 */

const MORPHO_API = 'https://blue-api.morpho.org/graphql';

export type MorphoVaultData = {
  address: string;
  name: string;
  assetSymbol: string;
  chainId: number;
  tvlUsd: number;
  netApyPercent: number;
};

type MorphoVaultConfig = {
  address: string;
  displayName?: string;
  chainId?: number;
};

const VAULT_LIST_QUERY = `
  query GetVaults($addresses: [String!]!) {
    vaults(where: { address_in: $addresses }) {
      items {
        address
        name
        chain { id }
        state {
          totalAssetsUsd
          netApy
        }
        asset { symbol }
      }
    }
  }
`;

/**
 * Parses MORPHO_VAULT_ADDRESSES env var.
 * Format: JSON array — [{"address":"0x...","name":"Vault Name","chainId":8453}, ...]
 * Falls back to the two well-known Base USDC vaults if not set.
 */
export function parseMorphoVaultConfigs(): MorphoVaultConfig[] {
  const raw = process.env.MORPHO_VAULT_ADDRESSES?.trim();

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return (parsed as Array<Record<string, unknown>>)
          .filter((item) => typeof item.address === 'string' && item.address.trim())
          .map((item) => ({
            address: (item.address as string).trim(),
            displayName: typeof item.name === 'string' ? item.name.trim() : undefined,
            chainId: typeof item.chainId === 'number' ? item.chainId : 8453
          }));
      }
    } catch {
      // fall through to defaults
    }
  }

  // Default: Gauntlet USDC Prime + Steakhouse High Yield USDC on Base
  return [
    { address: '0xeE8F4eC5672F09119b96Ab6fB59C27E1b7e44b61', displayName: 'Gauntlet USDC Prime', chainId: 8453 },
    { address: '0xCBeeF01994E24a60f7DCB8De98e75AD8BD4Ad60d', displayName: 'Steakhouse High Yield USDC', chainId: 8453 }
  ];
}

/**
 * Fetches live TVL and APY data for a list of vault addresses from Morpho Blue API.
 * Returns a map of lowercase(address) → MorphoVaultData.
 */
export async function fetchMorphoVaultData(
  configs: MorphoVaultConfig[]
): Promise<Map<string, MorphoVaultData>> {
  if (!configs.length) return new Map();

  const addresses = configs.map((c) => c.address);

  const response = await fetch(MORPHO_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: VAULT_LIST_QUERY,
      variables: { addresses }
    }),
    // Cache for 5 minutes at the edge
    next: { revalidate: 300 }
  } as RequestInit);

  if (!response.ok) {
    throw new Error(`MORPHO_API_FAILED:${response.status}`);
  }

  const json = (await response.json()) as {
    data?: { vaults?: { items?: Array<{
      address: string;
      name: string;
      chain?: { id: number };
      state?: { totalAssetsUsd?: number; netApy?: number };
      asset?: { symbol?: string };
    }> } };
    errors?: unknown[];
  };

  if (json.errors?.length) {
    console.warn('[morphoEarnService] GraphQL errors:', json.errors);
  }

  const result = new Map<string, MorphoVaultData>();
  const configByAddress = new Map(configs.map((c) => [c.address.toLowerCase(), c]));

  for (const item of json.data?.vaults?.items ?? []) {
    const key = item.address.toLowerCase();
    const cfg = configByAddress.get(key);
    result.set(key, {
      address: item.address,
      name: cfg?.displayName ?? item.name ?? item.address,
      assetSymbol: item.asset?.symbol ?? 'USDC',
      chainId: item.chain?.id ?? cfg?.chainId ?? 8453,
      tvlUsd: item.state?.totalAssetsUsd ?? 0,
      netApyPercent: (item.state?.netApy ?? 0) * 100
    });
  }

  // Fill in any addresses not returned by the API using config display names
  for (const cfg of configs) {
    const key = cfg.address.toLowerCase();
    if (!result.has(key)) {
      result.set(key, {
        address: cfg.address,
        name: cfg.displayName ?? cfg.address,
        assetSymbol: 'USDC',
        chainId: cfg.chainId ?? 8453,
        tvlUsd: 0,
        netApyPercent: 0
      });
    }
  }

  return result;
}
