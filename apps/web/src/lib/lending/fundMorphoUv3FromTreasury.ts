import {
  Contract,
  Interface,
  JsonRpcProvider,
  MaxUint256,
  formatUnits,
  getAddress,
  isAddress,
  parseUnits
} from 'ethers';
import { resolveMorphoLiquiditySigner } from '../blockchain/morphoLiquiditySigner';
import { execAsOwner } from '../blockchain/safeExec';
import { resolveTreasuryOwnerSigner } from '../blockchain/treasuryOwnerSigner';
import { resolveTreasuryAddress } from '../blockchain/treasuryPolicy';
import { waitForAutomationTx } from '../blockchain/automationTx';
import { getLendingChainConfig } from './baseContracts';
import { checkMorphoLiquidity } from './morphoLiquidityCheck';
import { getAdminAsset } from '../admin/assetsService';

/** UV3 / Añelo Apart Hotel Urban View Morpho Blue market (Base). */
export const UV3_PROJECT_ID = 'proj-anelo-apart-hotel-urban-view';
export const UV3_MARKET_ID =
  '0xacc94a3f8cf6c3bd4060d02a2888027540db4a147dc2d7249472b1623d102209';
export const UV3_ORACLE = '0x81bc0d8e0207E140b3101EB8Ffd2C387bD30AAEa';
export const UV3_COLLATERAL = '0x125782B1302be9a2f58849f8A86F25F78009b367';
export const UV3_IRM = '0x46415998764C29aB2a25CbeA6254146D50D22687';
export const UV3_LLTV = 625000000000000000n;

const DEFAULT_TREASURY_SAFE = '0xa993743CFB85E8d6481Ef60bb3D397F49604A592';
const DEFAULT_MORPHO_WALLET = '0xa27450116E04eb845d741767d9e798Ccf828fDC1';
const GAS_TOPUP_WEI = 1_000_000_000_000_000n; // 0.001 ETH
const MIN_OWNER_ETH_WEI = 500_000_000_000_000n; // 0.0005 ETH

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)'
];

const SAFE_ABI = [
  'function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address payable refundReceiver,bytes signatures) payable returns (bool success)',
  'function getOwners() view returns (address[])'
];

const MORPHO_SUPPLY_ABI = [
  'function supply((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) returns (uint256 assetsSupplied, uint256 sharesSupplied)',
  'function market(bytes32 id) view returns (uint128 totalSupplyAssets,uint128 totalSupplyShares,uint128 totalBorrowAssets,uint128 totalBorrowShares,uint128 lastUpdate,uint128 fee)'
];

function resolveRpcUrl(): string {
  return (
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org'
  );
}

export type FundMorphoUv3Result = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  amountUsdc?: string;
  treasurySafe?: string;
  morphoWallet?: string;
  gasTopUpTxHash?: string | null;
  transferTxHash?: string | null;
  supplyTxHash?: string | null;
  marketSupplyUsdcBefore?: string;
  marketSupplyUsdcAfter?: string;
  liquidity?: Awaited<ReturnType<typeof checkMorphoLiquidity>> | null;
  error?: string;
};

/**
 * Move USDC from the Sanova Safe treasury → Morpho liquidity wallet → UV3 Morpho market.
 * Used to apply investor USDC sitting in treasury into borrowable Morpho liquidity (e.g. 500 → 520).
 */
export async function fundMorphoUv3FromTreasury(input?: {
  amountUsdc?: number;
}): Promise<FundMorphoUv3Result> {
  const amountUsdc = input?.amountUsdc ?? 20;
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    return { ok: false, error: 'INVALID_AMOUNT' };
  }

  const treasurySafe =
    resolveTreasuryAddress(DEFAULT_TREASURY_SAFE) ||
    process.env.BASE_STABLECOIN_TREASURY_ADDRESS?.trim() ||
    DEFAULT_TREASURY_SAFE;
  const morphoWallet =
    process.env.MORPHO_LIQUIDITY_ADDRESS?.trim() || DEFAULT_MORPHO_WALLET;

  if (!isAddress(treasurySafe) || !isAddress(morphoWallet)) {
    return { ok: false, error: 'INVALID_ADDRESSES' };
  }

  /**
   * The market, its oracle and its collateral are pinned above. If the project
   * has since moved to another vault, nobody can post this market's collateral
   * any more, and supplying into it would be sending treasury USDC — investor
   * money — somewhere it can never be borrowed from. This runs on a daily cron,
   * so it would keep doing it.
   */
  const asset = await getAdminAsset(UV3_PROJECT_ID).catch(() => null);
  const currentVault = asset?.vaultAddress?.trim();
  if (currentVault && currentVault.toLowerCase() !== UV3_COLLATERAL.toLowerCase()) {
    return {
      ok: true,
      skipped: true,
      reason: `PROJECT_VAULT_CHANGED: el proyecto usa ${currentVault} y este mercado tiene como colateral ${UV3_COLLATERAL}. Hay que crear el mercado del vault nuevo y actualizar estas constantes.`
    };
  }

  const { morpho, usdc, chainId } = getLendingChainConfig();
  const provider = new JsonRpcProvider(resolveRpcUrl());

  try {
    const usdcContract = new Contract(usdc, ERC20_ABI, provider);
    const decimals = Number(await usdcContract.decimals());
    const requested = parseUnits(amountUsdc.toFixed(decimals), decimals);
    const treasuryBalance = (await usdcContract.balanceOf(treasurySafe)) as bigint;

    if (treasuryBalance <= 0n) {
      return {
        ok: true,
        skipped: true,
        reason: 'TREASURY_NO_USDC',
        treasurySafe,
        morphoWallet,
        amountUsdc: '0'
      };
    }

    const transferAmount = treasuryBalance < requested ? treasuryBalance : requested;
    const morphoContract = new Contract(morpho, MORPHO_SUPPLY_ABI, provider);
    const marketBefore = await morphoContract.market(UV3_MARKET_ID);
    const supplyBefore = formatUnits(marketBefore.totalSupplyAssets, decimals);

    const morphoSigner = await resolveMorphoLiquiditySigner(provider, chainId);
    if (!morphoSigner) {
      return { ok: false, error: 'MORPHO_LIQUIDITY_SIGNER_NOT_CONFIGURED' };
    }

    let treasurySigner;
    try {
      treasurySigner = await resolveTreasuryOwnerSigner(provider, chainId);
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : 'TREASURY_OWNER_NOT_CONFIGURED'
      };
    }
    if (!treasurySigner) {
      return { ok: false, error: 'TREASURY_OWNER_NOT_CONFIGURED' };
    }

    const ownerAddress = getAddress(await treasurySigner.getAddress());
    const safe = new Contract(treasurySafe, SAFE_ABI, treasurySigner);
    const owners: string[] = await safe.getOwners();
    if (!owners.some((owner) => owner.toLowerCase() === ownerAddress.toLowerCase())) {
      return {
        ok: false,
        error: `TREASURY_SIGNER_NOT_SAFE_OWNER:${ownerAddress}`
      };
    }

    let gasTopUpTxHash: string | null = null;
    const ownerEth = await provider.getBalance(ownerAddress);
    if (ownerEth < MIN_OWNER_ETH_WEI) {
      const morphoEth = await provider.getBalance(await morphoSigner.getAddress());
      if (morphoEth <= GAS_TOPUP_WEI) {
        return { ok: false, error: 'INSUFFICIENT_MORPHO_ETH_FOR_GAS_TOPUP' };
      }
      const gasTx = await morphoSigner.sendTransaction({
        to: ownerAddress,
        value: GAS_TOPUP_WEI
      });
      const gasReceipt = await waitForAutomationTx(gasTx);
      gasTopUpTxHash = gasReceipt?.hash ?? gasTx.hash;
    }

    const erc20Iface = new Interface(ERC20_ABI);
    const transferData = erc20Iface.encodeFunctionData('transfer', [
      getAddress(morphoWallet),
      transferAmount
    ]);

    const transferTxHash = await execAsOwner({
      owner: treasurySafe,
      signer: treasurySigner,
      target: usdc,
      data: transferData
    });

    const morphoUsdc = new Contract(usdc, ERC20_ABI, morphoSigner);
    const morphoBalance = (await morphoUsdc.balanceOf(await morphoSigner.getAddress())) as bigint;
    if (morphoBalance < transferAmount) {
      return {
        ok: false,
        error: 'MORPHO_WALLET_MISSING_USDC_AFTER_TRANSFER',
        transferTxHash,
        gasTopUpTxHash,
        treasurySafe,
        morphoWallet
      };
    }

    const approveTx = await morphoUsdc.approve(morpho, MaxUint256);
    await waitForAutomationTx(approveTx);

    const morphoWrite = new Contract(morpho, MORPHO_SUPPLY_ABI, morphoSigner);
    const marketParams = {
      loanToken: usdc,
      collateralToken: UV3_COLLATERAL,
      oracle: UV3_ORACLE,
      irm: UV3_IRM,
      lltv: UV3_LLTV
    };
    const onBehalf = await morphoSigner.getAddress();
    await morphoWrite.supply.staticCall(marketParams, transferAmount, 0, onBehalf, '0x');
    const supplyTx = await morphoWrite.supply(marketParams, transferAmount, 0, onBehalf, '0x');
    const supplyReceipt = await waitForAutomationTx(supplyTx);
    const supplyTxHash = supplyReceipt?.hash ?? supplyTx.hash;

    const marketAfter = await morphoContract.market(UV3_MARKET_ID);
    const supplyAfter = formatUnits(marketAfter.totalSupplyAssets, decimals);

    const asset = await getAdminAsset(UV3_PROJECT_ID);
    const liquidity = asset ? await checkMorphoLiquidity(asset) : null;

    return {
      ok: true,
      amountUsdc: formatUnits(transferAmount, decimals),
      treasurySafe,
      morphoWallet,
      gasTopUpTxHash,
      transferTxHash,
      supplyTxHash,
      marketSupplyUsdcBefore: supplyBefore,
      marketSupplyUsdcAfter: supplyAfter,
      liquidity
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'FUND_MORPHO_UV3_FAILED'
    };
  } finally {
    provider.destroy();
  }
}
