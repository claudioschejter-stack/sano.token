import { Contract, JsonRpcProvider } from 'ethers';
import type { AdminAssetRecord } from '../admin/assetsService';
import { appendDeploymentEvent, getAdminAsset, updateAdminAsset } from '../admin/assetsService';
import { notifyMorphoLiquidity } from '../admin/automationAlerts';
import { resolveMorphoChainId } from '../blockchain/explorerUrls';
import { getLendingChainConfig } from './baseContracts';
import { buildDefaultMorphoMarketParams } from './protocols/morphoBorrow';

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
    const morpho = new Contract(
      getLendingChainConfig().morpho,
      ['function expectedMarketBalances((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams) view returns (uint256 totalSupplyAssets,uint256 totalSupplyShares,uint256 totalBorrowAssets,uint256 totalBorrowShares)'],
      provider
    );
    const balances = await morpho.expectedMarketBalances([
      params.loanToken,
      params.collateralToken,
      params.oracle,
      params.irm,
      params.lltv
    ]);
    const totalSupplyAssets = BigInt(balances.totalSupplyAssets ?? balances[0] ?? 0);
    const totalBorrowAssets = BigInt(balances.totalBorrowAssets ?? balances[2] ?? 0);
    const availableAssets = totalSupplyAssets > totalBorrowAssets ? totalSupplyAssets - totalBorrowAssets : 0n;
    const status = availableAssets > 0n ? 'LIQUID' : 'NO_LIQUIDITY';

    await updateAdminAsset(asset.id, { morphoLiquidityStatus: status });
    await appendDeploymentEvent(asset.id, {
      step: 'MORPHO_LIQUIDITY',
      status: status === 'LIQUID' ? 'SUCCESS' : 'FAILED',
      message: `Liquidez Morpho disponible: ${availableAssets.toString()} unidades base.`,
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
