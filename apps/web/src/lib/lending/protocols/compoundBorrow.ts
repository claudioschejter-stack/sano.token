import { Interface } from 'ethers';
import { getLendingChainConfig } from '../baseContracts';
import type { PreparedTransaction } from './aaveBorrow';

const ERC20_ABI = ['function approve(address spender, uint256 amount) returns (bool)'];
const COMET_ABI = [
  'function supply(address asset, uint amount)',
  'function withdraw(address asset, uint amount)'
];

const erc20Interface = new Interface(ERC20_ABI);
const cometInterface = new Interface(COMET_ABI);

export function prepareCompoundWethCollateralBorrow(
  collateralWei: bigint,
  borrowBaseUnits: bigint
): PreparedTransaction[] {
  const config = getLendingChainConfig();
  const compound = config.compound;
  if (!compound) {
    return [];
  }

  const { comet, weth, usdc } = compound;

  return [
    {
      to: weth,
      data: erc20Interface.encodeFunctionData('approve', [comet, collateralWei]),
      value: '0',
      description: 'Approve WETH for Compound III'
    },
    {
      to: comet,
      data: cometInterface.encodeFunctionData('supply', [weth, collateralWei]),
      value: '0',
      description: 'Supply WETH collateral on Compound III'
    },
    {
      to: comet,
      data: cometInterface.encodeFunctionData('withdraw', [usdc, borrowBaseUnits]),
      value: '0',
      description: 'Borrow USDC on Compound III'
    }
  ];
}
