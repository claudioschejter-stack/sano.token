import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Contract, JsonRpcProvider, Wallet, formatUnits } from 'ethers';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

async function main() {
  const provider = new JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
  const wallet = new Wallet(process.env.TOKEN_DEPLOY_PRIVATE_KEY!.trim(), provider);
  const addr = await wallet.getAddress();
  const usdc = new Contract(
    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
    provider
  );
  const morpho = new Contract(
    '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
    [
      'function position(bytes32 id, address user) view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)',
      'function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)'
    ],
    provider
  );
  const marketId = '0x81e928e6f75f1c5a7f59a1b3f9d96e856b537fbecb53914e156df346b8f1a00d';
  const dec = await usdc.decimals();
  const bal = await usdcContractBalance(usdc, addr);
  const dest = '0xa27450116E04eb845d741767d9e798Ccf828fDC1';
  const destBal = await usdcContractBalance(usdc, dest);
  const pos = await morpho.position(marketId, addr);
  const market = await morpho.market(marketId);
  const receipt = await provider.getTransactionReceipt(
    '0x884bdedc802bb91b3aa1ef3d2310f28936d88395b95959508c6bcab0834c855e'
  );

  console.log(
    JSON.stringify(
      {
        addr,
        usdc: formatUnits(bal, dec),
        destUsdc: formatUnits(destBal, dec),
        supplyShares: pos[0].toString(),
        market: {
          totalSupplyAssets: market[0].toString(),
          totalBorrowAssets: market[2].toString()
        },
        txStatus: receipt?.status,
        txHash: receipt?.hash
      },
      null,
      2
    )
  );
  provider.destroy();
}

async function usdcContractBalance(contract: Contract, account: string) {
  return contract.balanceOf(account) as Promise<bigint>;
}

main().catch(console.error);
