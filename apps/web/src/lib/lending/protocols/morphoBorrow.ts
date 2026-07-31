import { AbiCoder, Interface, keccak256, getAddress } from 'ethers';
import { getLendingChainConfig } from '../baseContracts';

export type MorphoMarketParams = {
  loanToken: string;
  collateralToken: string;
  oracle: string;
  irm: string;
  lltv: bigint;
};

const MORPHO_ABI = [
  'function borrow((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver)',
  'function createMarket((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams)',
  'function idToMarketParams(bytes32 id) view returns (address loanToken,address collateralToken,address oracle,address irm,uint256 lltv)',
  'function expectedMarketBalances((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams) view returns (uint256 totalSupplyAssets,uint256 totalSupplyShares,uint256 totalBorrowAssets,uint256 totalBorrowShares)'
];

const morphoInterface = new Interface(MORPHO_ABI);

export function morphoMarketId(params: MorphoMarketParams): string {
  const coder = AbiCoder.defaultAbiCoder();
  return keccak256(
    coder.encode(
      ['address', 'address', 'address', 'address', 'uint256'],
      [
        getAddress(params.loanToken),
        getAddress(params.collateralToken),
        getAddress(params.oracle),
        getAddress(params.irm),
        params.lltv
      ]
    )
  );
}

export function prepareMorphoBorrowUsdc(
  params: MorphoMarketParams,
  amountBaseUnits: bigint,
  onBehalf: string,
  receiver: string
) {
  const { morpho } = getLendingChainConfig();
  const data = morphoInterface.encodeFunctionData('borrow', [
    [params.loanToken, params.collateralToken, params.oracle, params.irm, params.lltv],
    amountBaseUnits,
    0,
    onBehalf,
    receiver
  ]);

  return {
    to: morpho,
    data,
    value: '0',
    description: 'Borrow USDC on Morpho Blue',
    marketId: morphoMarketId(params)
  };
}

export function prepareMorphoCreateMarket(params: MorphoMarketParams) {
  const { morpho } = getLendingChainConfig();
  const data = morphoInterface.encodeFunctionData('createMarket', [
    [params.loanToken, params.collateralToken, params.oracle, params.irm, params.lltv]
  ]);

  return {
    to: morpho,
    data,
    value: '0',
    description: 'Create Morpho Blue market for RWA vault collateral',
    marketId: morphoMarketId(params)
  };
}

/** True when value is a 32-byte hex Morpho market id. */
export function isMorphoMarketId(value?: string | null): value is string {
  return Boolean(value && /^0x[0-9a-fA-F]{64}$/.test(value.trim()));
}

/**
 * Prefer the market id persisted at Morpho registration (`externalId`).
 * Recomputing from defaults can miss the seeded market when LLTV/IRM env drifts.
 */
export function resolveMorphoMarketId(
  morphoTarget: { externalId?: string | null } | null | undefined,
  params: MorphoMarketParams
): string {
  const externalId = morphoTarget?.externalId?.trim();
  if (isMorphoMarketId(externalId)) {
    return externalId;
  }
  return morphoMarketId(params);
}

export function resolveMorphoLltvBps(chainDefaultBps: number): number {
  const envRaw = process.env.MORPHO_DEFAULT_LLTV_BPS?.trim();
  if (envRaw) {
    const parsed = Number(envRaw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return Number.isFinite(chainDefaultBps) && chainDefaultBps > 0 ? chainDefaultBps : 6250;
}

export function buildDefaultMorphoMarketParams(
  vaultAddress: string,
  oracleAddress?: string | null
): MorphoMarketParams | null {
  const oracle = oracleAddress?.trim() || process.env.MORPHO_ORACLE_ADDRESS?.trim();
  if (!oracle) {
    return null;
  }

  const chainConfig = getLendingChainConfig();
  const { usdc, morphoIrm } = chainConfig;
  const lltvBps = resolveMorphoLltvBps(chainConfig.morphoDefaultLltvBps);

  return {
    loanToken: usdc,
    collateralToken: vaultAddress,
    oracle,
    irm: morphoIrm,
    lltv: BigInt(lltvBps) * 10n ** 14n
  };
}
