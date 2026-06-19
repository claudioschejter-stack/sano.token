import { Contract, JsonRpcProvider } from 'ethers';

const NAV_MARKET_ID =
  '0x114aee5443b74e9527c14fad35968a4fe98090941888fc8c8a88d4c33c3936e7';

async function main() {
  const provider = new JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
  const morpho = new Contract(
    '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
    ['function idToMarketParams(bytes32 id) view returns (address,address,address,address,uint256)'],
    provider
  );
  const r = await morpho.idToMarketParams(NAV_MARKET_ID);
  console.log(
    JSON.stringify(
      {
        marketId: NAV_MARKET_ID,
        loan: r[0],
        collateral: r[1],
        oracle: r[2],
        irm: r[3],
        lltv: r[4].toString()
      },
      null,
      2
    )
  );
  provider.destroy();
}

main().catch(console.error);
