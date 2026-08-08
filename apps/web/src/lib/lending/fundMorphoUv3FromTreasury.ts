import {
  Contract,
  Interface,
  JsonRpcProvider,
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
import { ensureAllowance } from '../blockchain/ensureAllowance';

/** UV3 / Añelo Apart Hotel Urban View. */
export const UV3_PROJECT_ID = 'proj-anelo-apart-hotel-urban-view';

/**
 * The market is resolved at run time, not pinned here.
 *
 * It used to be four hardcoded addresses, and they went stale the moment the
 * project moved to a corrected vault: the market id, the oracle and the
 * collateral all pointed at a vault that had been emptied. A daily cron would
 * have kept supplying treasury USDC — investor money — into a market whose
 * collateral nobody could post any more.
 *
 * The project's registered market id is the only thing worth remembering, and
 * the parameters come from the chain, which cannot disagree with itself.
 */
export type ResolvedMorphoMarket = {
  marketId: string;
  params: { loanToken: string; collateralToken: string; oracle: string; irm: string; lltv: bigint };
};

function registeredMarketId(collateralTargets: unknown): string | null {
  const targets = Array.isArray(collateralTargets)
    ? (collateralTargets as Array<Record<string, unknown>>)
    : [];
  for (const target of targets) {
    const id = typeof target.externalId === 'string' ? target.externalId.trim() : '';
    if (target.protocol === 'MORPHO' && /^0x[0-9a-fA-F]{64}$/.test(id)) {
      return id;
    }
  }
  return null;
}

export async function resolveProjectMorphoMarket(input: {
  provider: JsonRpcProvider;
  morphoAddress: string;
  projectId: string;
}): Promise<{ ok: true; market: ResolvedMorphoMarket } | { ok: false; reason: string }> {
  const asset = await getAdminAsset(input.projectId).catch(() => null);
  const vault = asset?.vaultAddress?.trim();
  if (!vault) {
    return { ok: false, reason: 'PROJECT_HAS_NO_VAULT' };
  }

  const marketId = registeredMarketId(asset?.collateralTargets);
  if (!marketId) {
    return {
      ok: false,
      reason:
        'NO_MORPHO_MARKET_REGISTERED: corré POST /api/admin/assets/<projectId>/register-collateral con protocols ["MORPHO"] para crear el mercado del vault actual.'
    };
  }

  const morpho = new Contract(input.morphoAddress, MORPHO_PARAMS_ABI, input.provider);
  const params = (await morpho.idToMarketParams(marketId)) as unknown as [
    string,
    string,
    string,
    string,
    bigint
  ];

  if (params[1].toLowerCase() !== vault.toLowerCase()) {
    return {
      ok: false,
      reason: `MARKET_COLLATERAL_MISMATCH: el proyecto usa ${vault} y el mercado registrado tiene como colateral ${params[1]}.`
    };
  }

  return {
    ok: true,
    market: {
      marketId,
      params: {
        loanToken: params[0],
        collateralToken: params[1],
        oracle: params[2],
        irm: params[3],
        lltv: params[4]
      }
    }
  };
}

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

const MORPHO_PARAMS_ABI = [
  'function idToMarketParams(bytes32) view returns (address loanToken,address collateralToken,address oracle,address irm,uint256 lltv)'
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

  const { morpho, usdc, chainId } = getLendingChainConfig();
  const provider = new JsonRpcProvider(resolveRpcUrl());

  try {
    /**
     * Resolve the market before moving any money, and refuse if its collateral
     * is not the project's current vault. Supplying into a market nobody can
     * post collateral to would be sending treasury USDC — investor money —
     * somewhere it can never be borrowed from, once a day, forever.
     */
    const resolved = await resolveProjectMorphoMarket({
      provider,
      morphoAddress: morpho,
      projectId: UV3_PROJECT_ID
    });

    if (resolved.ok === false) {
      return { ok: true, skipped: true, reason: resolved.reason };
    }

    const { marketId, params: marketParams } = resolved.market;
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
    const marketBefore = await morphoContract.market(marketId);
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

    // Infinite once, not infinite every day.
    await ensureAllowance({
      token: usdc,
      owner: await morphoSigner.getAddress(),
      spender: morpho,
      signer: morphoSigner
    });

    // `marketParams` came from the chain for this market id, so supply cannot
    // land in a different market than the one that was just checked.
    const morphoWrite = new Contract(morpho, MORPHO_SUPPLY_ABI, morphoSigner);
    const onBehalf = await morphoSigner.getAddress();
    await morphoWrite.supply.staticCall(marketParams, transferAmount, 0, onBehalf, '0x');
    const supplyTx = await morphoWrite.supply(marketParams, transferAmount, 0, onBehalf, '0x');
    const supplyReceipt = await waitForAutomationTx(supplyTx);
    const supplyTxHash = supplyReceipt?.hash ?? supplyTx.hash;

    const marketAfter = await morphoContract.market(marketId);
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
