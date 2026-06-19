#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AbiCoder, Contract, JsonRpcProvider, keccak256, getAddress } from 'ethers';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

const NEW_SAFE = getAddress('0xa993743CFB85E8d6481Ef60bb3D397F49604A592');
const OLD_SAFE = getAddress('0x5e7480c43f99cBCc90550a16356C90793c300d52');
const coder = AbiCoder.defaultAbiCoder();

const VAULTS = [
  { name: 'uv3-old', vault: '0x125782B1302be9a2f58849f8A86F25F78009b367', token: '0x481fAa4102Fb080e8291cA49d1e70bA42d36c8F1' },
  { name: 'uv3-new', vault: '0x95F1359144c66C8dDFd709D7111a36CAE8bb6089', token: '0x1dD753e74C68E5Acfa4846D5336e7D552C999664' }
] as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function actionId(kind: string, account: string, allowed: boolean): string {
  return keccak256(coder.encode(['string', 'address', 'bool'], [kind, account, allowed]));
}

async function main() {
  const rpc =
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org';
  const provider = new JsonRpcProvider(rpc, 8453, { staticNetwork: true });
  const now = Math.floor(Date.now() / 1000);

  for (const { name, vault, token } of VAULTS) {
    await sleep(2500);
    const tokenContract = new Contract(
      token,
      [
        'function owner() view returns (address)',
        'function adminActionReadyAt(bytes32) view returns (uint256)',
        'function kycApproved(address) view returns (bool)',
        'function externalContractAllowed(address) view returns (bool)'
      ],
      provider
    );
    const vaultContract = new Contract(
      vault,
      [
        'function owner() view returns (address)',
        'function adminActionReadyAt(bytes32) view returns (uint256)',
        'function externalContractAllowed(address) view returns (bool)'
      ],
      provider
    );

    const kycId = actionId('SET_KYC', NEW_SAFE, true);
    const extTokenId = actionId('SET_EXTERNAL_CONTRACT_ALLOWED', NEW_SAFE, true);
    const extVaultId = actionId('SET_EXTERNAL_CONTRACT_ALLOWED', NEW_SAFE, true);

    console.log(`\n=== ${name} ===`);
    console.log('tokenOwner', await tokenContract.owner());
    console.log('vaultOwner', await vaultContract.owner());
    console.log('newSafe kyc', await tokenContract.kycApproved(NEW_SAFE));
    console.log('newSafe extToken', await tokenContract.externalContractAllowed(NEW_SAFE));
    console.log('newSafe extVault', await vaultContract.externalContractAllowed(NEW_SAFE));

    for (const [label, id] of [
      ['kyc', kycId],
      ['extToken', extTokenId],
      ['extVault', extVaultId]
    ] as const) {
      const contract = label === 'extVault' ? vaultContract : tokenContract;
      const readyAt = (await contract.adminActionReadyAt(id)) as bigint;
      if (readyAt === 0n) {
        console.log(`${label} scheduled: no`);
      } else {
        const ready = Number(readyAt) <= now;
        console.log(`${label} scheduled: yes readyAt=${new Date(Number(readyAt) * 1000).toISOString()} ready=${ready}`);
      }
    }
  }

  provider.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
