import { Contract, JsonRpcProvider, formatUnits, isAddress } from 'ethers';
import { getPlatformWalletConfig } from './platformWalletConfig';
import { resolveMorphoLiquidityAddress } from '../blockchain/morphoLiquiditySigner';
import { resolveMorphoSeedUsdcForProject } from '../lending/morphoSeedLiquidity';
import { getLendingChainConfig } from '../lending/baseContracts';
import { BASE_MAINNET_CHAIN_ID } from '../blockchain/supportedChains';

export const MIN_OPERATOR_ETH = 0.002;
export const MIN_MORPHO_ETH = 0.005;
export const MIN_TREASURY_ETH = 0.001;

export type PlatformWalletBalanceRow = {
  id: 'rwaOperator' | 'tokenTreasury' | 'morphoLiquidity' | 'stablecoinTreasury';
  label: string;
  address: string | null;
  configured: boolean;
  ethBalance: number | null;
  usdcBalance: number | null;
  minEthRequired: number;
  minUsdcRequired: number;
  ethSufficient: boolean;
  usdcSufficient: boolean;
  sufficient: boolean;
  detail?: string;
};

export type PlatformWalletBalancesReport = {
  chainId: number;
  chainName: string;
  explorerBaseUrl: string;
  usdcTokenAddress: string;
  morphoSeedUsdcRequired: number;
  wallets: PlatformWalletBalanceRow[];
  allSufficient: boolean;
  fetchedAt: string;
};

function resolveBaseRpcUrl(): string {
  return (
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org'
  );
}

async function readEthUsdcBalances(
  provider: JsonRpcProvider,
  usdcAddress: string,
  address: string
): Promise<{ eth: number; usdc: number }> {
  const usdc = new Contract(
    usdcAddress,
    [
      'function balanceOf(address account) view returns (uint256)',
      'function decimals() view returns (uint8)'
    ],
    provider
  );

  const [ethWei, usdcRaw, decimals] = await Promise.all([
    provider.getBalance(address),
    usdc.balanceOf(address),
    usdc.decimals()
  ]);

  return {
    eth: Number(formatUnits(ethWei, 18)),
    usdc: Number(formatUnits(usdcRaw, decimals))
  };
}

export async function getPlatformWalletBalances(input?: {
  totalTokens?: number;
  pricePerToken?: number;
}): Promise<PlatformWalletBalancesReport> {
  const config = getPlatformWalletConfig();
  const lending = getLendingChainConfig();
  const morphoAddress = resolveMorphoLiquidityAddress();

  const totalTokens = input?.totalTokens ?? 0;
  const pricePerToken = input?.pricePerToken ?? 0;
  const morphoSeedUsdcRequired =
    totalTokens > 0 && pricePerToken > 0
      ? resolveMorphoSeedUsdcForProject({ totalTokens, pricePerToken })
      : Number(process.env.MORPHO_SEED_LIQUIDITY_USDC ?? '100') || 100;

  const walletSpecs: Array<{
    id: PlatformWalletBalanceRow['id'];
    label: string;
    address: string | null;
    minEthRequired: number;
    minUsdcRequired: number;
  }> = [
    {
      id: 'rwaOperator',
      label: 'Operador RWA (deploy)',
      address: config.rwaOperatorAddress,
      minEthRequired: MIN_OPERATOR_ETH,
      minUsdcRequired: 0
    },
    {
      id: 'tokenTreasury',
      label: 'Treasury token (Safe)',
      address: config.tokenTreasuryAddress,
      minEthRequired: MIN_TREASURY_ETH,
      minUsdcRequired: 0
    },
    {
      id: 'morphoLiquidity',
      label: 'Liquidez Morpho (seed USDC)',
      address: morphoAddress,
      minEthRequired: MIN_MORPHO_ETH,
      minUsdcRequired: morphoSeedUsdcRequired
    },
    {
      id: 'stablecoinTreasury',
      label: 'Treasury USDC (pagos)',
      address: config.stablecoinTreasuryAddress,
      minEthRequired: 0,
      minUsdcRequired: 0
    }
  ];

  const provider = new JsonRpcProvider(resolveBaseRpcUrl());
  const wallets: PlatformWalletBalanceRow[] = [];

  try {
    for (const spec of walletSpecs) {
      if (!spec.address || !isAddress(spec.address)) {
        wallets.push({
          id: spec.id,
          label: spec.label,
          address: spec.address,
          configured: false,
          ethBalance: null,
          usdcBalance: null,
          minEthRequired: spec.minEthRequired,
          minUsdcRequired: spec.minUsdcRequired,
          ethSufficient: spec.minEthRequired <= 0,
          usdcSufficient: spec.minUsdcRequired <= 0,
          sufficient: false,
          detail: 'Dirección no configurada'
        });
        continue;
      }

      try {
        const { eth, usdc } = await readEthUsdcBalances(provider, lending.usdc, spec.address);
        const ethSufficient = eth >= spec.minEthRequired;
        const usdcSufficient = usdc >= spec.minUsdcRequired;
        wallets.push({
          id: spec.id,
          label: spec.label,
          address: spec.address,
          configured: true,
          ethBalance: eth,
          usdcBalance: usdc,
          minEthRequired: spec.minEthRequired,
          minUsdcRequired: spec.minUsdcRequired,
          ethSufficient,
          usdcSufficient,
          sufficient: ethSufficient && usdcSufficient
        });
      } catch (error) {
        wallets.push({
          id: spec.id,
          label: spec.label,
          address: spec.address,
          configured: true,
          ethBalance: null,
          usdcBalance: null,
          minEthRequired: spec.minEthRequired,
          minUsdcRequired: spec.minUsdcRequired,
          ethSufficient: false,
          usdcSufficient: spec.minUsdcRequired <= 0,
          sufficient: false,
          detail: error instanceof Error ? error.message : 'Error leyendo balances'
        });
      }
    }
  } finally {
    provider.destroy();
  }

  const operationalWallets = wallets.filter((wallet) => wallet.id !== 'stablecoinTreasury');

  return {
    chainId: BASE_MAINNET_CHAIN_ID,
    chainName: config.chainName,
    explorerBaseUrl: config.explorerBaseUrl,
    usdcTokenAddress: lending.usdc,
    morphoSeedUsdcRequired,
    wallets,
    allSufficient: operationalWallets.every((wallet) => wallet.sufficient),
    fetchedAt: new Date().toISOString()
  };
}
