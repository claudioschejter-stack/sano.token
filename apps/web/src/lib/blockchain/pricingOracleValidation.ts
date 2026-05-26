import { Contract, JsonRpcProvider } from 'ethers';
import type { AdminAssetRecord } from '../admin/assetsService';
import { resolveChainId } from './explorerUrls';

const MORPHO_PRICE_SCALE_DECIMALS = 24n;

function resolveRpcUrl(chainId: number): string {
  if (chainId === 84532 || chainId === 8453) {
    return process.env.BASE_RPC_URL?.trim() || (chainId === 84532 ? 'https://sepolia.base.org' : 'https://mainnet.base.org');
  }
  return process.env.BASE_RPC_URL?.trim() || 'https://sepolia.base.org';
}

export function fixedUsdPriceToMorphoOraclePrice(pricePerTokenUsd: number): bigint | null {
  if (!Number.isFinite(pricePerTokenUsd) || pricePerTokenUsd <= 0) {
    return null;
  }

  const microUsd = BigInt(Math.round(pricePerTokenUsd * 1_000_000));
  return microUsd * 10n ** (MORPHO_PRICE_SCALE_DECIMALS - 6n);
}

export async function validateOraclePricing(asset: AdminAssetRecord) {
  const expected = fixedUsdPriceToMorphoOraclePrice(asset.pricePerToken);
  const hasMorpho = asset.collateralTargets.some((target) => target.protocol === 'MORPHO');
  if (!expected) {
    return { ok: false, message: 'Precio por token inválido para oracle.' };
  }

  const navEstimate = asset.totalTokens * asset.pricePerToken;
  if (!Number.isFinite(navEstimate) || navEstimate <= 0) {
    return { ok: false, message: 'NAV estimado inválido.' };
  }

  const morphoTarget = asset.collateralTargets.find((target) => target.protocol === 'MORPHO');
  const oracleAddress = morphoTarget?.oracleAddress ?? process.env.MORPHO_ORACLE_ADDRESS?.trim();
  if (!hasMorpho || !oracleAddress) {
    const canDeployOracle = Boolean((process.env.TOKEN_DEPLOY_PRIVATE_KEY ?? process.env.PRIVATE_KEY)?.trim());
    return {
      ok: !hasMorpho || canDeployOracle,
      message:
        hasMorpho && canDeployOracle
          ? `Oracle fijo se desplegará automáticamente. NAV estimado USD ${navEstimate}.`
          : hasMorpho
            ? 'Morpho requiere oracle desplegado/configurado o deployer para crear oracle fijo.'
            : `NAV estimado USD ${navEstimate}.`
    };
  }

  const chainId = asset.chainId ?? resolveChainId();
  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
  try {
    const oracle = new Contract(oracleAddress, ['function price() view returns (uint256)'], provider);
    const onChainPrice = BigInt(await oracle.price());
    const toleranceBps = Number(process.env.MORPHO_ORACLE_TOLERANCE_BPS ?? '100');
    const diff = onChainPrice > expected ? onChainPrice - expected : expected - onChainPrice;
    const withinTolerance = diff * 10_000n <= expected * BigInt(toleranceBps);
    return {
      ok: withinTolerance,
      message: withinTolerance
        ? `Oracle OK (${oracleAddress}). NAV estimado USD ${navEstimate}.`
        : `Oracle price no coincide con precio del asset. Esperado ${expected}, on-chain ${onChainPrice}.`
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'No se pudo leer oracle price().'
    };
  } finally {
    provider.destroy();
  }
}
