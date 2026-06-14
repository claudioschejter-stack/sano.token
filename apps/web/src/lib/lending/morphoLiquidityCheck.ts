import { Contract, JsonRpcProvider } from 'ethers';
import type { AdminAssetRecord } from '../admin/assetsService';
import { appendDeploymentEvent, getAdminAsset, updateAdminAsset } from '../admin/assetsService';
import { notifyMorphoLiquidity } from '../admin/automationAlerts';
import { resolveMorphoChainId } from '../blockchain/explorerUrls';
import { getLendingChainConfig } from './baseContracts';
import { buildDefaultMorphoMarketParams, morphoMarketId } from './protocols/morphoBorrow';

function resolveRpcUrl(chainId: number): string {
  if (chainId === 8453) {
    return (
      process.env.LENDING_BASE_RPC_URL?.trim() ||
      process.env.BASE_RPC_URL?.trim() ||
      'https://mainnet.base.org'
    );
  }
  if (chainId === 84532) {
    return process.env.BASE_SEPOLIA_RPC_URL?.trim() || process.env.BASE_RPC_URL?.trim() || 'https://sepolia.base.org';
  }
  return process.env.LENDING_BASE_RPC_URL?.trim() || process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
}

export async function checkMorphoLiquidity(asset: AdminAssetRecord) {
  const morphoTarget = asset.collateralTargets.find((target) => target.protocol === 'MORPHO');
  if (!morphoTarget || !asset.vaultAddress || !morphoTarget.oracleAddress) {
    await updateAdminAsset(asset.id, { morphoLiquidityStatus: 'NO_MARKET' });
    return { status: 'NO_MARKET' as const, availableAssets: '0' };
  }

  const params = buildDefaultMorphoMarketParams(asset.vaultAddress, morphoTarget.oracleAddress);
  if (!params) {
    await updateAdminAsset(asset.id, { morphoLiquidityStatus: 'NO_MARKET' });
    return { status: 'NO_MARKET' as const, availableAssets: '0' };
  }

  const chainId = resolveMorphoChainId();
  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
  try {
    const { seedMorphoLiquidityIfConfigured } = await import('./morphoLiquiditySeed');
    const seedResult = await seedMorphoLiquidityIfConfigured(params, {
      totalTokens: asset.totalTokens,
      pricePerToken: asset.pricePerToken
    }).catch(() => ({ txHash: null, targetUsdc: 0, skippedReason: 'SEED_FAILED' as const }));

    const seedDetail =
      'seededUsdc' in seedResult && seedResult.seededUsdc !== undefined
        ? ` (sembrado ${seedResult.seededUsdc}${'partial' in seedResult && seedResult.partial ? ' parcial' : ''})`
        : '';

    const morpho = new Contract(
      getLendingChainConfig().morpho,
      [
        'function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)'
      ],
      provider
    );
    const marketId = morphoMarketId(params);
    const market = await morpho.market(marketId);
    const totalSupplyAssets = BigInt(market.totalSupplyAssets ?? market[0] ?? 0);
    const totalBorrowAssets = BigInt(market.totalBorrowAssets ?? market[2] ?? 0);
    const availableAssets = totalSupplyAssets > totalBorrowAssets ? totalSupplyAssets - totalBorrowAssets : 0n;
    const status = availableAssets > 0n ? 'LIQUID' : 'NO_LIQUIDITY';

    await updateAdminAsset(asset.id, { morphoLiquidityStatus: status });
    await appendDeploymentEvent(asset.id, {
      step: 'MORPHO_LIQUIDITY',
      status: status === 'LIQUID' ? 'SUCCESS' : 'FAILED',
      message: `Liquidez Morpho disponible: ${availableAssets.toString()} unidades base. Seed objetivo: ${seedResult.targetUsdc} USDC${seedDetail}${seedResult.txHash ? ` (tx ${seedResult.txHash})` : seedResult.skippedReason ? ` (${seedResult.skippedReason})` : ''}.`,
      externalId: morphoTarget.externalId ?? null
    });
    if (status !== 'LIQUID') {
      await notifyMorphoLiquidity(asset.id, asset.title, status);
    } else {
      const refreshed = await getAdminAsset(asset.id);
      await appendDeploymentEvent(asset.id, {
        step: 'READY_TO_BORROW',
        status: refreshed?.readyToBorrow ? 'SUCCESS' : 'PENDING',
        message: refreshed?.readyToBorrow
          ? 'Activo listo para solicitar préstamo Morpho por asset.'
          : 'Liquidez OK; faltan otros requisitos para ready-to-borrow.',
        externalId: morphoTarget.externalId ?? null
      });
    }

    return { status, availableAssets: availableAssets.toString() };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Morpho liquidity check failed';
    await updateAdminAsset(asset.id, { morphoLiquidityStatus: 'FAILED' });
    await appendDeploymentEvent(asset.id, {
      step: 'MORPHO_LIQUIDITY',
      status: 'FAILED',
      message
    });
    await notifyMorphoLiquidity(asset.id, asset.title, 'FAILED');
    return { status: 'FAILED' as const, availableAssets: '0', error: message };
  } finally {
    provider.destroy();
  }
}

/** Read-only Morpho market liquidity probe (no USDC seeding). */
export async function probeMorphoLiquidityStatus(asset: AdminAssetRecord) {
  const morphoTarget = asset.collateralTargets.find((target) => target.protocol === 'MORPHO');
  if (!morphoTarget || !asset.vaultAddress || !morphoTarget.oracleAddress) {
    await updateAdminAsset(asset.id, { morphoLiquidityStatus: 'NO_MARKET' });
    return { status: 'NO_MARKET' as const, availableAssets: '0' };
  }

  const params = buildDefaultMorphoMarketParams(asset.vaultAddress, morphoTarget.oracleAddress);
  if (!params) {
    await updateAdminAsset(asset.id, { morphoLiquidityStatus: 'NO_MARKET' });
    return { status: 'NO_MARKET' as const, availableAssets: '0' };
  }

  const chainId = resolveMorphoChainId();
  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
  try {
    const morpho = new Contract(
      getLendingChainConfig().morpho,
      [
        'function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)'
      ],
      provider
    );
    const marketId = morphoMarketId(params);
    const market = await morpho.market(marketId);
    const totalSupplyAssets = BigInt(market.totalSupplyAssets ?? market[0] ?? 0);
    const totalBorrowAssets = BigInt(market.totalBorrowAssets ?? market[2] ?? 0);
    const availableAssets = totalSupplyAssets > totalBorrowAssets ? totalSupplyAssets - totalBorrowAssets : 0n;
    const status = availableAssets > 0n ? 'LIQUID' : 'NO_LIQUIDITY';

    await updateAdminAsset(asset.id, { morphoLiquidityStatus: status });

    return { status, availableAssets: availableAssets.toString() };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Morpho liquidity probe failed';
    await updateAdminAsset(asset.id, { morphoLiquidityStatus: 'FAILED' });
    return { status: 'FAILED' as const, availableAssets: '0', error: message };
  } finally {
    provider.destroy();
  }
}
