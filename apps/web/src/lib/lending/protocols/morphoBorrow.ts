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
  const lltvRaw = Number(
    process.env.MORPHO_DEFAULT_LLTV_BPS ?? chainConfig.morphoDefaultLltvBps ?? '6250'
  );
  const lltvBps = Number.isFinite(lltvRaw) ? lltvRaw : 6000;

  return {
    loanToken: usdc,
    collateralToken: vaultAddress,
    oracle,
    irm: morphoIrm,
    lltv: BigInt(lltvBps) * 10n ** 14n
  };
}
