import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Contract, JsonRpcProvider } from 'ethers';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
config({ path: resolve(root, '.env') });

const treasury = '0x5e7480c43f99cBCc90550a16356C90793c300d52';
const vaults = [
  ['uv3-old', '0x125782B1302be9a2f58849f8A86F25F78009b367', '0x481fAa4102Fb080e8291cA49d1e70bA42d36c8F1'],
  ['uv3-new', '0x95F1359144c66C8dDFd709D7111a36CAE8bb6089', '0x1dD753e74C68E5Acfa4846D5336e7D552C999664']
] as const;

async function main() {
  for (const rpc of [
    process.env.LENDING_BASE_RPC_URL,
    process.env.BASE_RPC_URL,
    'https://mainnet.base.org'
  ]) {
    if (!rpc) continue;
    console.log('\nRPC', rpc);
    const provider = new JsonRpcProvider(rpc);
    for (const [name, vault, token] of vaults) {
      const vaultContract = new Contract(vault, ['function balanceOf(address) view returns (uint256)'], provider);
      const tokenContract = new Contract(token, ['function kycApproved(address) view returns (bool)'], provider);
      const shares = await vaultContract.balanceOf(treasury);
      const kyc = await tokenContract.kycApproved(treasury);
      console.log(name, 'shares', shares.toString(), 'kyc', kyc);
    }
    provider.destroy();
  }
}

main().catch(console.error);
