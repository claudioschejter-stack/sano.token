import { Interface, keccak256, solidityPacked } from 'ethers';
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
  'function idToMarketParams(bytes32 id) view returns (address loanToken,address collateralToken,address oracle,address irm,uint256 lltv)'
];

const morphoInterface = new Interface(MORPHO_ABI);

export function morphoMarketId(params: MorphoMarketParams): string {
  return keccak256(
    solidityPacked(
      ['address', 'address', 'address', 'address', 'uint256'],
      [params.loanToken, params.collateralToken, params.oracle, params.irm, params.lltv]
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

export function buildDefaultMorphoMarketParams(vaultAddress: string): MorphoMarketParams | null {
  const oracle = process.env.MORPHO_ORACLE_ADDRESS?.trim();
  if (!oracle) {
    return null;
  }

  const { usdc, morphoIrm } = getLendingChainConfig();
  const lltvRaw = Number(process.env.MORPHO_DEFAULT_LLTV_BPS ?? '6000');
  const lltvBps = Number.isFinite(lltvRaw) ? lltvRaw : 6000;

  return {
    loanToken: usdc,
    collateralToken: vaultAddress,
    oracle,
    irm: morphoIrm,
    lltv: BigInt(lltvBps) * 10n ** 14n
  };
}
