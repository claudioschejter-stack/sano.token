import { Contract, JsonRpcProvider, formatUnits, getAddress, isAddress, parseUnits } from 'ethers';
import { resolveMorphoLiquiditySigner } from '../blockchain/morphoLiquiditySigner';
import { resolveTreasuryAddress } from '../blockchain/treasuryPolicy';
import { waitForAutomationTx } from '../blockchain/automationTx';
import { readWithRetry } from '../blockchain/rpcRetry';
import { getLendingChainConfig } from './baseContracts';

/**
 * Pull supplied USDC back out of a Morpho market.
 *
 * The platform could put treasury USDC into a market and never take it out,
 * which matters the moment a market is abandoned — migrating a project to a new
 * vault leaves its old market with nobody able to post collateral, and the
 * liquidity sitting in it is real money.
 *
 * Market params are read from the chain rather than from constants, so this
 * keeps working for a market the code no longer hardcodes.
 */

const MORPHO_ABI = [
  'function idToMarketParams(bytes32) view returns (address loanToken,address collateralToken,address oracle,address irm,uint256 lltv)',
  'function market(bytes32) view returns (uint128 totalSupplyAssets,uint128 totalSupplyShares,uint128 totalBorrowAssets,uint128 totalBorrowShares,uint128 lastUpdate,uint128 fee)',
  'function position(bytes32,address) view returns (uint256 supplyShares,uint128 borrowShares,uint128 collateral)',
  'function withdraw((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams,uint256 assets,uint256 shares,address onBehalf,address receiver) returns (uint256 assetsWithdrawn,uint256 sharesWithdrawn)'
];

const ERC20_ABI = ['function decimals() view returns (uint8)'];

function rpcUrl(): string {
  return (
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org'
  );
}

export type WithdrawMorphoLiquidityResult =
  | {
      ok: true;
      marketId: string;
      /** Who held the supply position and signed. */
      supplier: string;
      receiver: string;
      amountUsdc: string;
      txHash: string;
      remainingSuppliedUsdc: string;
    }
  | { ok: false; code: string; detail?: string };

export async function withdrawMorphoLiquidity(input: {
  marketId: string;
  /** Omit to take everything out, which avoids leaving rounding dust behind. */
  amountUsdc?: number;
  /** Defaults to the treasury, so the money goes back where it came from. */
  receiver?: string;
}): Promise<WithdrawMorphoLiquidityResult> {
  const marketId = input.marketId.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(marketId)) {
    return { ok: false, code: 'INVALID_MARKET_ID' };
  }

  const receiver = input.receiver?.trim() || resolveTreasuryAddress();
  if (!receiver || !isAddress(receiver)) {
    return { ok: false, code: 'INVALID_RECEIVER' };
  }

  const { morpho, usdc, chainId } = getLendingChainConfig();
  const provider = new JsonRpcProvider(rpcUrl());

  try {
    const signer = await resolveMorphoLiquiditySigner(provider, chainId).catch(() => null);
    if (!signer) {
      return {
        ok: false,
        code: 'MORPHO_SIGNER_MISSING',
        detail: 'Configurá PRIVY_MORPHO_LIQUIDITY_WALLET_ID + MORPHO_LIQUIDITY_ADDRESS.'
      };
    }
    const supplier = getAddress(await signer.getAddress());

    const reader = new Contract(morpho, MORPHO_ABI, provider);
    const params = await readWithRetry(() => reader.idToMarketParams(marketId) as Promise<unknown[]>);
    const market = await readWithRetry(() => reader.market(marketId) as Promise<bigint[]>);
    const position = await readWithRetry(
      () => reader.position(marketId, supplier) as Promise<bigint[]>
    );

    if (!params || !market || !position) {
      return { ok: false, code: 'MARKET_READ_FAILED' };
    }
    if (position[0] <= 0n) {
      return {
        ok: false,
        code: 'NO_SUPPLY_POSITION',
        detail: `${supplier} no tiene liquidez suministrada en ${marketId}`
      };
    }

    const decimals = Number(
      (await readWithRetry(
        () => new Contract(usdc, ERC20_ABI, provider).decimals() as Promise<bigint>
      )) ?? 6n
    );

    /**
     * Withdrawing by shares takes the whole position without leaving dust that a
     * later `assets` figure would round away. Only a partial request needs the
     * asset amount.
     */
    let assetsArg = 0n;
    let sharesArg = position[0];
    if (input.amountUsdc !== undefined) {
      if (!Number.isFinite(input.amountUsdc) || input.amountUsdc <= 0) {
        return { ok: false, code: 'INVALID_AMOUNT' };
      }
      assetsArg = parseUnits(input.amountUsdc.toFixed(decimals), decimals);
      sharesArg = 0n;
    }

    // Borrowed liquidity is not sitting there to be taken.
    const idle = market[0] - market[2];
    const wanted =
      assetsArg > 0n ? assetsArg : (position[0] * market[0]) / (market[1] === 0n ? 1n : market[1]);
    if (idle < wanted) {
      return {
        ok: false,
        code: 'INSUFFICIENT_IDLE_LIQUIDITY',
        detail: `el mercado tiene ${formatUnits(idle, decimals)} USDC libres y se piden ${formatUnits(wanted, decimals)}`
      };
    }

    const marketParams = {
      loanToken: params[0] as string,
      collateralToken: params[1] as string,
      oracle: params[2] as string,
      irm: params[3] as string,
      lltv: params[4] as bigint
    };

    const writer = new Contract(morpho, MORPHO_ABI, signer);
    await writer.withdraw.staticCall(
      marketParams,
      assetsArg,
      sharesArg,
      supplier,
      getAddress(receiver)
    );
    const tx = await writer.withdraw(
      marketParams,
      assetsArg,
      sharesArg,
      supplier,
      getAddress(receiver)
    );
    const receipt = await waitForAutomationTx(tx);

    const after = await readWithRetry(() => reader.market(marketId) as Promise<bigint[]>);

    return {
      ok: true,
      marketId,
      supplier,
      receiver: getAddress(receiver),
      amountUsdc: formatUnits(wanted, decimals),
      txHash: receipt?.hash ?? tx.hash,
      remainingSuppliedUsdc: after ? formatUnits(after[0], decimals) : 'no se pudo leer'
    };
  } catch (error) {
    return {
      ok: false,
      code: 'WITHDRAW_FAILED',
      detail: error instanceof Error ? error.message.slice(0, 250) : undefined
    };
  } finally {
    provider.destroy();
  }
}
