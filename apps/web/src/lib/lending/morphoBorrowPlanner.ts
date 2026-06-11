import { Contract, JsonRpcProvider, MaxUint256 } from 'ethers';
import type { AdminAssetRecord } from '../admin/assetsService';
import { getLendingChainConfig } from './baseContracts';
import { resolveMorphoChainId } from '../blockchain/explorerUrls';
import {
  buildDefaultMorphoMarketParams,
  morphoMarketId,
  type MorphoMarketParams
} from './protocols/morphoBorrow';
import type { PreparedTransaction } from './protocols/aaveBorrow';
import { borrowSafetyBps, maxBorrowUsdPerProject } from '../blockchain/securityPolicy';

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)'
];

const VAULT_ABI = [
  'function deposit(uint256 assets, address receiver) returns (uint256 shares)',
  'function convertToAssets(uint256 shares) view returns (uint256)',
  'function convertToShares(uint256 assets) view returns (uint256)',
  'function asset() view returns (address)',
  'function decimals() view returns (uint8)'
];

function resolveRpcUrl(chainId: number): string {
  if (chainId === 8453) {
    return (
      process.env.LENDING_BASE_RPC_URL?.trim() ||
      process.env.BASE_RPC_URL?.trim() ||
      'https://mainnet.base.org'
    );
  }
  return process.env.BASE_SEPOLIA_RPC_URL?.trim() || process.env.BASE_RPC_URL?.trim() || 'https://sepolia.base.org';
}

function lltvRatio(): number {
  const lltvBps = Number(process.env.MORPHO_DEFAULT_LLTV_BPS ?? '6000');
  const safeBps = borrowSafetyBps();
  return (lltvBps * safeBps) / 100_000_000;
}

export type MorphoBorrowPreview = {
  chainId: number;
  vaultAddress: string;
  vaultShareBalance: string;
  underlyingAssetBalance: string;
  maxBorrowUsd: number;
  suggestedBorrowUsd: number;
  collateralSharesRequired: string;
  marketId: string | null;
  ready: boolean;
  message?: string;
};

function usdcToBaseUnits(amountUsd: number): bigint {
  return BigInt(Math.round(amountUsd * 1_000_000));
}

function sharesForBorrowUsd(amountUsd: number, pricePerToken: number, shareScale: number): bigint {
  if (amountUsd <= 0 || pricePerToken <= 0 || shareScale <= 0) return 0n;
  const ratio = lltvRatio();
  if (ratio <= 0) return 0n;
  const collateralUsd = amountUsd / ratio;
  const shares = collateralUsd / pricePerToken;
  return BigInt(Math.max(1, Math.ceil(shares * shareScale)));
}

export async function previewMorphoBorrow(input: {
  asset: AdminAssetRecord;
  walletAddress: string;
  amountUsd?: number;
  oracleAddress?: string | null;
}): Promise<MorphoBorrowPreview | null> {
  const vault = input.asset.vaultAddress?.trim();
  if (!vault || !input.asset.readyToBorrow) {
    return null;
  }

  const marketParams = buildDefaultMorphoMarketParams(vault, input.oracleAddress);
  if (!marketParams) {
    return null;
  }

  const chainId = resolveMorphoChainId();
  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));

  try {
    const vaultContract = new Contract(vault, [...ERC20_ABI, ...VAULT_ABI], provider);
    const vaultShareBalance = (await vaultContract.balanceOf(input.walletAddress)) as bigint;
    const shareDecimals = Number(await vaultContract.decimals());
    const shareScale = 10 ** shareDecimals;

    let underlyingAssetBalance = 0n;
    let underlyingDecimals = 6;
    const assetToken = input.asset.contractAddress?.trim();
    if (assetToken) {
      const token = new Contract(assetToken, ERC20_ABI, provider);
      underlyingAssetBalance = (await token.balanceOf(input.walletAddress)) as bigint;
      underlyingDecimals = Number(await token.decimals());
    }

    const assetsFromShares = (await vaultContract.convertToAssets(vaultShareBalance)) as bigint;
    const underlyingAddress = (await vaultContract.asset()) as string;
    const underlyingContract = new Contract(underlyingAddress, ERC20_ABI, provider);
    const vaultAssetDecimals = Number(await underlyingContract.decimals());

    const collateralUsdFromShares = Number(assetsFromShares) / 10 ** vaultAssetDecimals;
    const collateralUsdFromUnderlying =
      (Number(underlyingAssetBalance) / 10 ** underlyingDecimals) * input.asset.pricePerToken;
    const totalCollateralUsd = collateralUsdFromShares + collateralUsdFromUnderlying;
    const maxByCollateral = totalCollateralUsd * lltvRatio();
    const maxByAsset = maxBorrowUsdPerProject();
    const navCap =
      input.asset.totalTokens * input.asset.pricePerToken * Number(process.env.MORPHO_DEFAULT_LLTV_BPS ?? '6000') * borrowSafetyBps() / 100_000_000;
    const maxBorrowUsd = Math.max(0, Math.min(maxByCollateral, maxByAsset, navCap));

    const requested = input.amountUsd && input.amountUsd > 0 ? input.amountUsd : maxBorrowUsd;
    const suggestedBorrowUsd = Math.min(requested, maxBorrowUsd);
    const collateralSharesRequired = sharesForBorrowUsd(
      suggestedBorrowUsd,
      input.asset.pricePerToken,
      shareScale
    );

    return {
      chainId,
      vaultAddress: vault,
      vaultShareBalance: vaultShareBalance.toString(),
      underlyingAssetBalance: underlyingAssetBalance.toString(),
      maxBorrowUsd: Math.round(maxBorrowUsd * 100) / 100,
      suggestedBorrowUsd: Math.round(suggestedBorrowUsd * 100) / 100,
      collateralSharesRequired: collateralSharesRequired.toString(),
      marketId: morphoMarketId(marketParams),
      ready: maxBorrowUsd > 0 && suggestedBorrowUsd > 0,
      message:
        maxBorrowUsd <= 0
          ? 'Necesitás tokens RWA en tu wallet para usarlos como colateral Morpho.'
          : undefined
    };
  } finally {
    provider.destroy();
  }
}

function encodeApprove(token: string, spender: string, amount: bigint): PreparedTransaction {
  const iface = new Contract(token, ERC20_ABI).interface;
  return {
    to: token,
    data: iface.encodeFunctionData('approve', [spender, amount]),
    value: '0',
    description: 'Approve token spend'
  };
}

function encodeVaultDeposit(vault: string, assets: bigint, receiver: string): PreparedTransaction {
  const iface = new Contract(vault, VAULT_ABI).interface;
  return {
    to: vault,
    data: iface.encodeFunctionData('deposit', [assets, receiver]),
    value: '0',
    description: 'Deposit RWA into ERC-4626 vault'
  };
}

function encodeSupplyCollateral(
  params: MorphoMarketParams,
  assets: bigint,
  onBehalf: string
): PreparedTransaction {
  const { morpho } = getLendingChainConfig();
  const iface = new Contract(
    morpho,
    ['function supplyCollateral((address,address,address,address,uint256),uint256,address,bytes)']
  ).interface;
  return {
    to: morpho,
    data: iface.encodeFunctionData('supplyCollateral', [
      [params.loanToken, params.collateralToken, params.oracle, params.irm, params.lltv],
      assets,
      onBehalf,
      '0x'
    ]),
    value: '0',
    description: 'Supply vault shares as Morpho collateral'
  };
}

export async function planMorphoBorrowTransactions(input: {
  asset: AdminAssetRecord;
  walletAddress: string;
  amountUsd: number;
  oracleAddress?: string | null;
}): Promise<{ transactions: PreparedTransaction[]; marketId: string } | null> {
  const vault = input.asset.vaultAddress?.trim();
  if (!vault || !input.asset.readyToBorrow || input.amountUsd <= 0) {
    return null;
  }

  const marketParams = buildDefaultMorphoMarketParams(vault, input.oracleAddress);
  if (!marketParams) {
    return null;
  }

  const preview = await previewMorphoBorrow({
    asset: input.asset,
    walletAddress: input.walletAddress,
    amountUsd: input.amountUsd,
    oracleAddress: input.oracleAddress
  });

  if (!preview?.ready || preview.suggestedBorrowUsd <= 0) {
    return null;
  }

  const borrowUsd = Math.min(input.amountUsd, preview.suggestedBorrowUsd);
  const borrowAmount = usdcToBaseUnits(borrowUsd);

  const chainId = resolveMorphoChainId();
  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
  const transactions: PreparedTransaction[] = [];

  try {
    const vaultContract = new Contract(vault, [...ERC20_ABI, ...VAULT_ABI], provider);
    const shareDecimals = Number(await vaultContract.decimals());
    const shareScale = 10 ** shareDecimals;
    let sharesNeeded = sharesForBorrowUsd(borrowUsd, input.asset.pricePerToken, shareScale);
    let vaultShareBalance = (await vaultContract.balanceOf(input.walletAddress)) as bigint;

    if (vaultShareBalance < sharesNeeded && input.asset.contractAddress) {
      const assetToken = input.asset.contractAddress.trim();
      const token = new Contract(assetToken, ERC20_ABI, provider);
      const underlyingBalance = (await token.balanceOf(input.walletAddress)) as bigint;
      const shareDeficit = sharesNeeded - vaultShareBalance;
      const depositAssets = (await vaultContract.convertToAssets(shareDeficit)) as bigint;
      const depositAmount = depositAssets > underlyingBalance ? underlyingBalance : depositAssets;

      if (depositAmount > 0n) {
        const allowance = (await token.allowance(input.walletAddress, vault)) as bigint;
        if (allowance < depositAmount) {
          transactions.push(encodeApprove(assetToken, vault, MaxUint256));
        }
        transactions.push(encodeVaultDeposit(vault, depositAmount, input.walletAddress));
        vaultShareBalance += (await vaultContract.convertToShares(depositAmount)) as bigint;
      }
    }

    if (vaultShareBalance < sharesNeeded) {
      sharesNeeded = vaultShareBalance;
    }

    if (sharesNeeded <= 0n) {
      return null;
    }

    const morpho = getLendingChainConfig().morpho;
    const allowanceToMorpho = (await vaultContract.allowance(input.walletAddress, morpho)) as bigint;
    if (allowanceToMorpho < sharesNeeded) {
      transactions.push(encodeApprove(vault, morpho, MaxUint256));
    }

    transactions.push(encodeSupplyCollateral(marketParams, sharesNeeded, input.walletAddress));

    const morphoIface = new Contract(
      morpho,
      ['function borrow((address,address,address,address,uint256),uint256,uint256,address,address)']
    ).interface;
    transactions.push({
      to: morpho,
      data: morphoIface.encodeFunctionData('borrow', [
        [marketParams.loanToken, marketParams.collateralToken, marketParams.oracle, marketParams.irm, marketParams.lltv],
        borrowAmount,
        0,
        input.walletAddress,
        input.walletAddress
      ]),
      value: '0',
      description: 'Borrow USDC on Morpho Blue'
    });

    return { transactions, marketId: morphoMarketId(marketParams) };
  } finally {
    provider.destroy();
  }
}
