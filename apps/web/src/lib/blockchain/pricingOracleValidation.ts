import { Contract, JsonRpcProvider } from 'ethers';
import type { AdminAssetRecord } from '../admin/assetsService';
import { resolveChainId } from './explorerUrls';
import { isRwaOperatorConfigured } from './rwaOperatorSigner';
import { readVaultShareDecimals } from './vaultShareUnits';

/**
 * Morpho values collateral as `amount * price / 1e36`, with both amounts in
 * their smallest units. So the price of one whole collateral token is
 * `microUsd * 10 ** (36 - collateralDecimals)`.
 *
 * The collateral is vault shares, and a vault's share decimals are the asset's
 * plus its `_decimalsOffset` — raised to 3 as an inflation-attack mitigation.
 * The old constant folded in 18 decimals, which was right for the vaults
 * deployed before that change and would value a share of any later vault a
 * thousand times too high: an investor could have borrowed far past what their
 * collateral is worth.
 */
const MORPHO_PRICE_BASE_DECIMALS = 36n;
const DEFAULT_COLLATERAL_DECIMALS = 18;

function resolveRpcUrl(chainId: number): string {
  if (chainId === 84532 || chainId === 8453) {
    return process.env.BASE_RPC_URL?.trim() || (chainId === 84532 ? 'https://sepolia.base.org' : 'https://mainnet.base.org');
  }
  return process.env.BASE_RPC_URL?.trim() || 'https://sepolia.base.org';
}

export function fixedUsdPriceToMorphoOraclePrice(
  pricePerTokenUsd: number,
  /** The collateral's own decimals — for a vault, `vault.decimals()`. */
  collateralDecimals: number = DEFAULT_COLLATERAL_DECIMALS
): bigint | null {
  if (!Number.isFinite(pricePerTokenUsd) || pricePerTokenUsd <= 0) {
    return null;
  }
  if (
    !Number.isInteger(collateralDecimals) ||
    collateralDecimals < 0 ||
    BigInt(collateralDecimals) > MORPHO_PRICE_BASE_DECIMALS
  ) {
    return null;
  }

  const microUsd = BigInt(Math.round(pricePerTokenUsd * 1_000_000));
  return microUsd * 10n ** (MORPHO_PRICE_BASE_DECIMALS - BigInt(collateralDecimals));
}

export async function validateOraclePricing(asset: AdminAssetRecord) {
  const hasMorpho = asset.collateralTargets.some((target) => target.protocol === 'MORPHO');

  /**
   * The expected price depends on the collateral's unit, so comparing against a
   * default would flag a correctly deployed oracle as wrong on any vault
   * carrying the decimals offset.
   */
  let collateralDecimals: number | undefined;
  if (asset.vaultAddress) {
    const chain = asset.chainId ?? resolveChainId();
    const reader = new JsonRpcProvider(resolveRpcUrl(chain));
    try {
      collateralDecimals =
        (await readVaultShareDecimals({ provider: reader, vaultAddress: asset.vaultAddress })) ??
        undefined;
    } finally {
      reader.destroy();
    }
  }

  const expected = fixedUsdPriceToMorphoOraclePrice(asset.pricePerToken, collateralDecimals);
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
    const canDeployOracle = isRwaOperatorConfigured();
    const oracleKind = (process.env.MORPHO_ORACLE_TYPE ?? 'nav').trim().toLowerCase() === 'fixed' ? 'fijo' : 'NAV ERC-4626';
    return {
      ok: !hasMorpho || canDeployOracle,
      message:
        hasMorpho && canDeployOracle
          ? `Oracle ${oracleKind} se desplegará automáticamente. NAV estimado USD ${navEstimate}.`
          : hasMorpho
            ? 'Morpho requiere oracle desplegado/configurado o deployer para crear oracle.'
            : `NAV estimado USD ${navEstimate}.`
    };
  }

  const chainId = asset.chainId ?? resolveChainId();
  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
  try {
    const isNavOracle = await provider
      .getCode(oracleAddress)
      .then((code) => code.length > 2);

    if (isNavOracle) {
      const navOracle = new Contract(
        oracleAddress,
        ['function navPerAssetMicroUsd() view returns (uint256)', 'function price() view returns (uint256)'],
        provider
      );
      try {
        const navPerAsset = Number(await navOracle.navPerAssetMicroUsd()) / 1_000_000;
        const onChainPrice = BigInt(await navOracle.price());
        const navExpected = fixedUsdPriceToMorphoOraclePrice(
          navPerAsset || asset.pricePerToken,
          collateralDecimals
        );
        if (navExpected) {
          const toleranceBps = Number(process.env.MORPHO_ORACLE_TOLERANCE_BPS ?? '100');
          const diff = onChainPrice > navExpected ? onChainPrice - navExpected : navExpected - onChainPrice;
          const withinTolerance = diff * 10_000n <= navExpected * BigInt(toleranceBps);
          return {
            ok: withinTolerance,
            message: withinTolerance
              ? `Oracle NAV OK (${oracleAddress}). NAV/activo USD ${navPerAsset}. NAV total estimado USD ${navEstimate}.`
              : `Oracle NAV diverge. price on-chain ${onChainPrice}, esperado ${navExpected}.`
          };
        }
      } catch {
        // Fall through to fixed-price validation.
      }
    }

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
