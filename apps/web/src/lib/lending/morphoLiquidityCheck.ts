import { Contract, JsonRpcProvider } from 'ethers';
import type { AdminAssetRecord } from '../admin/assetsService';
import { appendDeploymentEvent, updateAdminAsset } from '../admin/assetsService';
import { notifyMorphoLiquidity } from '../admin/automationAlerts';
import { resolveChainId } from '../blockchain/explorerUrls';
import { getLendingChainConfig } from './baseContracts';
import { buildDefaultMorphoMarketParams } from './protocols/morphoBorrow';

function resolveRpcUrl(chainId: number): string {
  if (chainId === 84532 || chainId === 8453) {
    return process.env.BASE_RPC_URL?.trim() || (chainId === 84532 ? 'https://sepolia.base.org' : 'https://mainnet.base.org');
  }
  return process.env.BASE_RPC_URL?.trim() || 'https://sepolia.base.org';
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

  const chainId = resolveChainId();
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
