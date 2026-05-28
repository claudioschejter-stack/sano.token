import { Interface } from 'ethers';
import { getLendingChainConfig } from '../baseContracts';
import type { PreparedTransaction } from './aaveBorrow';

const ERC20_ABI = ['function approve(address spender, uint256 amount) returns (bool)'];
const MTOKEN_ABI = ['function mint(uint256 mintAmount) returns (uint256)', 'function borrow(uint256 borrowAmount) returns (uint256)'];
const COMPTROLLER_ABI = ['function enterMarkets(address[] calldata mTokens) returns (uint256[] memory)'];

const erc20Interface = new Interface(ERC20_ABI);
const mTokenInterface = new Interface(MTOKEN_ABI);
const comptrollerInterface = new Interface(COMPTROLLER_ABI);

export function prepareMoonwellWethCollateralBorrow(
  collateralWei: bigint,
  borrowBaseUnits: bigint
): PreparedTransaction[] {
  const config = getLendingChainConfig();
  const moonwell = config.moonwell;
  if (!moonwell) {
    return [];
  }

  const { comptroller, mUsdc, mWeth, weth } = moonwell;

  return [
    {
      to: weth,
      data: erc20Interface.encodeFunctionData('approve', [mWeth, collateralWei]),
      value: '0',
      description: 'Approve WETH for Moonwell'
    },
    {
      to: mWeth,
      data: mTokenInterface.encodeFunctionData('mint', [collateralWei]),
      value: '0',
      description: 'Supply WETH collateral on Moonwell'
    },
    {
      to: comptroller,
      data: comptrollerInterface.encodeFunctionData('enterMarkets', [[mWeth]]),
      value: '0',
      description: 'Enable WETH as collateral on Moonwell'
    },
    {
      to: mUsdc,
      data: mTokenInterface.encodeFunctionData('borrow', [borrowBaseUnits]),
      value: '0',
      description: 'Borrow USDC on Moonwell'
    }
  ];
}
