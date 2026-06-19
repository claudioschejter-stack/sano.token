import { Contract, JsonRpcProvider, formatUnits } from 'ethers';

const MORPHO = '0xa27450116E04eb845d741767d9e798Ccf828fDC1';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const MARKET_ID = '0x114aee5443b74e9527c14fad35968a4fe98090941888fc8c8a88d4c33c3936e7';

async function main() {
  const provider = new JsonRpcProvider('https://mainnet.base.org');
  const usdc = new Contract(USDC, ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'], provider);
  const morpho = new Contract(
    '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
    [
      'function position(bytes32 id, address user) view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)',
      'function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)'
    ],
    provider
  );
  const dec = await usdc.decimals();
  const usdcBal = await usdc.balanceOf(MORPHO);
  const pos = await morpho.position(MARKET_ID, MORPHO);
  const market = await morpho.market(MARKET_ID);
  console.log(
    JSON.stringify(
      {
        walletUsdc: formatUnits(usdcBal, dec),
        supplyShares: pos[0].toString(),
        marketSupplyAssets: market[0].toString(),
        marketBorrowAssets: market[2].toString()
      },
      null,
      2
    )
  );
  provider.destroy();
}

main().catch(console.error);
