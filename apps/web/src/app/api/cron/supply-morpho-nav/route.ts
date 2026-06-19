import { NextResponse } from 'next/server';
import { Contract, JsonRpcProvider, MaxUint256, formatUnits } from 'ethers';
import { isCronRequestAuthorized } from '../../../../lib/cron/authorizeCronRequest';
import { resolveMorphoLiquiditySigner } from '../../../../lib/blockchain/morphoLiquiditySigner';
import { buildDefaultMorphoMarketParams } from '../../../../lib/lending/protocols/morphoBorrow';
import { getLendingChainConfig } from '../../../../lib/lending/baseContracts';
import { getAdminAsset, updateAdminAsset } from '../../../../lib/admin/assetsService';
import { checkMorphoLiquidity } from '../../../../lib/lending/morphoLiquidityCheck';

export const maxDuration = 120;

const PROJECT_ID = 'proj-apart-hotel-urban-view-anelo-mplonxbv';
const NAV_ORACLE = '0x2C56D06CbE212eB7343C3652D57A4C0E5976C257';
const NAV_MARKET_ID =
  '0x114aee5443b74e9527c14fad35968a4fe98090941888fc8c8a88d4c33c3936e7';

const MORPHO_SUPPLY_ABI = [
  'function supply((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) returns (uint256 assetsSupplied, uint256 sharesSupplied)'
];
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

/** Cron — supply full Morpho Liquidity wallet USDC into NAV market + refresh admin state. */
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const asset = await getAdminAsset(PROJECT_ID);
  if (!asset?.vaultAddress) {
    return NextResponse.json({ error: 'Vault not deployed' }, { status: 400 });
  }

  await updateAdminAsset(PROJECT_ID, {
    collateralTargets: [
      {
        protocol: 'MORPHO',
        status: 'REGISTERED',
        readinessScore: 100,
        missingRequirements: [],
        externalId: NAV_MARKET_ID,
        poolUrl: `https://app.morpho.org/base/market/${NAV_MARKET_ID}`,
        oracleAddress: NAV_ORACLE,
        notes: 'Mercado Morpho NAV — liquidez vía wallet Privy Morpho.',
        submittedAt: new Date().toISOString(),
        registeredAt: new Date().toISOString(),
        lastError: null
      }
    ]
  });

  const params = buildDefaultMorphoMarketParams(asset.vaultAddress, NAV_ORACLE);
  if (!params) {
    return NextResponse.json({ error: 'Invalid market params' }, { status: 400 });
  }

  const rpc =
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org';
  const chainId = getLendingChainConfig().chainId;
  const provider = new JsonRpcProvider(rpc);

  try {
    const wallet = await resolveMorphoLiquiditySigner(provider, chainId);
    if (!wallet) {
      return NextResponse.json({ error: 'Privy Morpho signer not configured' }, { status: 503 });
    }

    const walletAddress = await wallet.getAddress();
    const { morpho, usdc } = getLendingChainConfig();
    const usdcContract = new Contract(usdc, ERC20_ABI, wallet);
    const decimals = Number(await usdcContract.decimals());
    const usdcBalance = await usdcContract.balanceOf(walletAddress);
    const ethBalance = await provider.getBalance(walletAddress);

    if (ethBalance <= 0n) {
      return NextResponse.json({ error: 'Morpho liquidity wallet has no ETH for gas' }, { status: 503 });
    }
    if (usdcBalance <= 0n) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'NO_USDC_BALANCE' });
    }

    const approveTx = await usdcContract.approve(morpho, MaxUint256);
    await approveTx.wait();

    const morphoContract = new Contract(morpho, MORPHO_SUPPLY_ABI, wallet);
    const marketParams = {
      loanToken: params.loanToken,
      collateralToken: params.collateralToken,
      oracle: params.oracle,
      irm: params.irm,
      lltv: params.lltv
    };

    await morphoContract.supply.staticCall(marketParams, usdcBalance, 0, walletAddress, '0x');
    const supplyTx = await morphoContract.supply(marketParams, usdcBalance, 0, walletAddress, '0x');
    const receipt = await supplyTx.wait();

    const refreshed = await getAdminAsset(PROJECT_ID);
    const liquidity = refreshed ? await checkMorphoLiquidity(refreshed) : null;
    const finalAsset = await getAdminAsset(PROJECT_ID);

    return NextResponse.json({
      ok: true,
      wallet: walletAddress,
      suppliedUsdc: formatUnits(usdcBalance, decimals),
      txHash: receipt?.hash ?? supplyTx.hash,
      marketId: NAV_MARKET_ID,
      liquidity,
      readyToBorrow: finalAsset?.readyToBorrow ?? false,
      morphoLiquidityStatus: finalAsset?.morphoLiquidityStatus ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SUPPLY_FAILED';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    provider.destroy();
  }
}

export async function POST(request: Request) {
  return GET(request);
}
