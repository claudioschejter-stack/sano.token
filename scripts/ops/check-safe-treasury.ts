#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

const NEW_SAFE = process.argv[2]?.trim() || '0xa993743CFB85E8d6481Ef60bb3D397F49604A592';
const OLD_SAFE = '0x5e7480c43f99cBCc90550a16356C90793c300d52';
const PRIVY_OWNER = process.env.TREASURY_OWNER_ADDRESS?.trim() || '0x85CE193C49c0Cbf751F2180D2D91c084BC9E5eBA';
const CONFIGURED_TREASURY = process.env.TOKEN_TREASURY_ADDRESS?.trim() || '';

const VAULTS = [
  { name: 'uv3-old', vault: '0x125782B1302be9a2f58849f8A86F25F78009b367' },
  { name: 'uv3-new', vault: '0x95F1359144c66C8dDFd709D7111a36CAE8bb6089' }
];

async function safeInfo(provider: JsonRpcProvider, addr: string) {
  const code = await provider.getCode(addr);
  if (code === '0x') return { isSafe: false, owners: [] as string[], threshold: '0' };
  const safe = new Contract(
    addr,
    ['function getOwners() view returns (address[])', 'function getThreshold() view returns (uint256)'],
    provider
  );
  const [owners, threshold] = await Promise.all([safe.getOwners(), safe.getThreshold()]);
  return { isSafe: true, owners: owners as string[], threshold: threshold.toString() };
}

async function vaultShares(provider: JsonRpcProvider, holder: string) {
  const out: Record<string, string> = {};
  for (const { name, vault } of VAULTS) {
    const v = new Contract(vault, ['function balanceOf(address) view returns (uint256)'], provider);
    const shares = (await v.balanceOf(holder)) as bigint;
    out[name] = formatUnits(shares, 18);
  }
  return out;
}

async function main() {
  const rpc =
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://base-mainnet.g.alchemy.com/v2/demo';
  const provider = new JsonRpcProvider(rpc);

  console.log('Configured TOKEN_TREASURY_ADDRESS:', CONFIGURED_TREASURY || '(empty)');
  console.log('Expected new Safe:', NEW_SAFE);
  console.log('Privy treasury owner:', PRIVY_OWNER);
  console.log('RPC:', rpc.replace(/\/v2\/[^/]+$/, '/v2/***'));

  const newInfo = await safeInfo(provider, NEW_SAFE);
  const oldInfo = await safeInfo(provider, OLD_SAFE);
  const newShares = await vaultShares(provider, NEW_SAFE);
  const oldShares = await vaultShares(provider, OLD_SAFE);
  const privyIsOwnerNew = newInfo.owners.some(
    (o) => o.toLowerCase() === PRIVY_OWNER.toLowerCase()
  );
  const privyIsOwnerOld = oldInfo.owners.some(
    (o) => o.toLowerCase() === PRIVY_OWNER.toLowerCase()
  );

  console.log('\n--- New Safe', NEW_SAFE, '---');
  console.log('isSafe:', newInfo.isSafe, 'threshold:', newInfo.threshold);
  console.log('owners:', newInfo.owners.join(', ') || '(none)');
  console.log('Privy owner listed:', privyIsOwnerNew ? 'YES' : 'NO');
  console.log('vault shares:', newShares);

  console.log('\n--- Old Safe', OLD_SAFE, '---');
  console.log('isSafe:', oldInfo.isSafe, 'threshold:', oldInfo.threshold);
  console.log('owners:', oldInfo.owners.join(', ') || '(none)');
  console.log('Privy owner listed:', privyIsOwnerOld ? 'YES' : 'NO');
  console.log('vault shares:', oldShares);

  const envMatch =
    CONFIGURED_TREASURY.toLowerCase() === NEW_SAFE.toLowerCase() ? 'OK' : 'MISMATCH';
  console.log('\n--- Summary ---');
  console.log('Env points to new Safe:', envMatch);
  console.log(
    'Platform ready:',
    newInfo.isSafe &&
      privyIsOwnerNew &&
      envMatch === 'OK' &&
      Number(newShares['uv3-new']) > 0
      ? 'LIKELY OK (shares migrated + owner + env)'
      : 'NOT YET — see items above'
  );

  provider.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
