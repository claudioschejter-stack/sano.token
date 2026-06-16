import { Contract, JsonRpcProvider } from 'ethers';
import { getAdminAsset, listAdminAssets, type AdminAssetRecord } from '../admin/assetsService';
import { resolveMorphoChainId } from '../blockchain/explorerUrls';
import { validateNavOraclePrice } from '../blockchain/navOracleService';

export type PublicNavReport = {
  slug: string;
  projectId: string;
  title: string;
  jurisdiction: string | null;
  spvEntityName: string | null;
  token: {
    symbol: string | null;
    contractAddress: string | null;
    vaultAddress: string | null;
    chainId: number | null;
    totalSupply: number;
    pricePerTokenUsd: number;
  };
  nav: {
    totalNavUsd: number;
    pricePerTokenUsd: number;
    methodology: 'erc4626_vault_nav';
    auditModel: 'physical_property_appraisal';
    lastUpdated: string;
  };
  oracle: {
    type: 'SANOVA_NAV_ERC4626' | 'SANOVA_FIXED_PRICE' | 'UNKNOWN';
    address: string | null;
    onChainPriceValid: boolean | null;
    message: string | null;
  };
  morpho: {
    marketId: string | null;
    marketUrl: string | null;
    metaMorphoVault: string | null;
    metaMorphoPoolUrl: string | null;
    lltvBps: number | null;
  };
  legal: {
    trustDocumentUrl: string | null;
    purchaseDocumentUrl: string | null;
    leaseDocumentUrl: string | null;
    legalAuditDone: boolean;
  };
  generatedAt: string;
};

const SLUG_ALIASES: Record<string, string> = {
  'urban-view-anelo': 'proj-apart-hotel-urban-view-anelo-mplonxbv',
  'anelo-uv3': 'proj-apart-hotel-urban-view-anelo-mplonxbv',
  'apart-hotel-urban-view-anelo': 'proj-apart-hotel-urban-view-anelo-mplonxbv'
};

function resolveRpcUrl(): string {
  return (
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org'
  );
}

async function readOnChainNavOracleMeta(oracleAddress: string) {
  const provider = new JsonRpcProvider(resolveRpcUrl());
  try {
    const oracle = new Contract(
      oracleAddress,
      [
        'function navPerAssetMicroUsd() view returns (uint256)',
        'function lastNavUpdateAt() view returns (uint256)',
        'function lastAuditHash() view returns (bytes32)',
        'function vault() view returns (address)'
      ],
      provider
    );
    const [navPerAsset, lastUpdate, auditHash, vault] = await Promise.all([
      oracle.navPerAssetMicroUsd(),
      oracle.lastNavUpdateAt(),
      oracle.lastAuditHash(),
      oracle.vault()
    ]);
    return {
      navPerAssetMicroUsd: Number(navPerAsset) / 1_000_000,
      lastNavUpdateAt: Number(lastUpdate),
      auditHash: auditHash as string,
      vault: vault as string
    };
  } catch {
    return null;
  } finally {
    provider.destroy();
  }
}

async function resolveProjectForSlug(slug: string): Promise<AdminAssetRecord | null> {
  const alias = SLUG_ALIASES[slug];
  if (alias) {
    const asset = await getAdminAsset(alias);
    if (asset) return asset;
  }

  const assets = await listAdminAssets();
  return (
    assets.find((asset) => {
      const url = asset.navOracleUrl?.trim();
      if (!url) return false;
      return url.endsWith(`/${slug}`) || url.includes(`/nav/${slug}`);
    }) ?? null
  );
}

export async function buildPublicNavReport(slug: string): Promise<PublicNavReport | null> {
  const asset = await resolveProjectForSlug(slug);
  if (!asset) return null;

  const morpho = asset.collateralTargets.find((target) => target.protocol === 'MORPHO');
  const oracleAddress = morpho?.oracleAddress ?? process.env.MORPHO_ORACLE_ADDRESS?.trim() ?? null;
  const totalNavUsd = asset.totalTokens * asset.pricePerTokenUsd;

  let oracleType: PublicNavReport['oracle']['type'] = 'UNKNOWN';
  let onChainPriceValid: boolean | null = null;
  let oracleMessage: string | null = null;
  let lastUpdated = new Date().toISOString();

  if (oracleAddress) {
    const navMeta = await readOnChainNavOracleMeta(oracleAddress);
    if (navMeta) {
      oracleType = 'SANOVA_NAV_ERC4626';
      lastUpdated = new Date(navMeta.lastNavUpdateAt * 1000).toISOString();
      const validation = await validateNavOraclePrice(
        oracleAddress,
        navMeta.navPerAssetMicroUsd || asset.pricePerToken,
        asset.vaultAddress ?? undefined
      );
      onChainPriceValid = validation.ok;
      oracleMessage = validation.message;
    } else {
      oracleType = 'SANOVA_FIXED_PRICE';
      const validation = await validateNavOraclePrice(oracleAddress, asset.pricePerToken);
      onChainPriceValid = validation.ok;
      oracleMessage = validation.message;
    }
  }

  const metaMorphoVault = process.env.METAMORPHO_VAULT_ADDRESS?.trim() ?? null;

  return {
    slug,
    projectId: asset.id,
    title: asset.title,
    jurisdiction: asset.jurisdiction,
    spvEntityName: asset.spvEntityName,
    token: {
      symbol: asset.tokenSymbol,
      contractAddress: asset.contractAddress,
      vaultAddress: asset.vaultAddress,
      chainId: asset.chainId ?? resolveMorphoChainId(),
      totalSupply: asset.totalTokens,
      pricePerTokenUsd: asset.pricePerToken
    },
    nav: {
      totalNavUsd,
      pricePerTokenUsd: asset.pricePerToken,
      methodology: 'erc4626_vault_nav',
      auditModel: 'physical_property_appraisal',
      lastUpdated
    },
    oracle: {
      type: oracleType,
      address: oracleAddress,
      onChainPriceValid,
      message: oracleMessage
    },
    morpho: {
      marketId: morpho?.externalId ?? null,
      marketUrl: morpho?.poolUrl ?? null,
      metaMorphoVault,
      metaMorphoPoolUrl: metaMorphoVault ? `https://app.morpho.org/base/vault/${metaMorphoVault}` : null,
      lltvBps: Number(process.env.MORPHO_DEFAULT_LLTV_BPS ?? '6250')
    },
    legal: {
      trustDocumentUrl: asset.contracts.trust,
      purchaseDocumentUrl: asset.contracts.purchase,
      leaseDocumentUrl: asset.contracts.lease,
      legalAuditDone: asset.centrifugeChecklist.legalAuditDone
    },
    generatedAt: new Date().toISOString()
  };
}
