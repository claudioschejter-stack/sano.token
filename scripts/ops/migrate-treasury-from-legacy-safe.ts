#!/usr/bin/env node
/**
 * Move vault shares (and optional USDC) from the legacy Safe treasury to a new treasury address.
 * Signs with TOKEN_DEPLOY_PRIVATE_KEY — must be an owner of the old Safe.
 *
 * Usage:
 *   npx tsx scripts/ops/migrate-treasury-from-legacy-safe.ts --dry-run
 *   npx tsx scripts/ops/migrate-treasury-from-legacy-safe.ts --new-treasury 0x85CE...
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Contract, Interface, JsonRpcProvider, Wallet, formatUnits, getAddress, isAddress } from 'ethers';

function buildSafePreValidatedSignature(ownerAddress: string): string {
  const owner = getAddress(ownerAddress).slice(2).toLowerCase();
  return `0x${'0'.repeat(24)}${owner}${'0'.repeat(64)}01`;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

const OLD_TREASURY =
  process.env.OLD_TOKEN_TREASURY_ADDRESS?.trim() ||
  '0x5e7480c43f99cBCc90550a16356C90793c300d52';

const DEFAULT_NEW_TREASURY =
  process.argv.find((a) => a.startsWith('--new-treasury='))?.split('=')[1]?.trim() ||
  process.env.TREASURY_OWNER_ADDRESS?.trim() ||
  '0x85CE193C49c0Cbf751F2180D2D91c084BC9E5eBA';

const VAULTS = [
  {
    name: 'uv3-old',
    vault: '0x125782B1302be9a2f58849f8A86F25F78009b367',
    token: '0x481fAa4102Fb080e8291cA49d1e70bA42d36c8F1'
  },
  {
    name: 'uv3-new (Añelo)',
    vault: '0x95F1359144c66C8dDFd709D7111a36CAE8bb6089',
    token: '0x1dD753e74C68E5Acfa4846D5336e7D552C999664'
  }
] as const;

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const SAFE_ABI = [
  'function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address payable refundReceiver,bytes signatures) payable returns (bool success)',
  'function getOwners() view returns (address[])'
];

const TOKEN_ABI = [
  'function kycApproved(address) view returns (bool)',
  'function setKyc(address,bool)',
  'function owner() view returns (address)'
];
const VAULT_ABI = ['function balanceOf(address) view returns (uint256)', 'function transfer(address,uint256) returns (bool)'];
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)', 'function transfer(address,uint256) returns (bool)', 'function decimals() view returns (uint8)'];

function readFlag(name: string): boolean {
  return process.argv.includes(name);
}

function readArg(name: string): string | undefined {
  const eq = process.argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.split('=')[1]?.trim();
  const idx = process.argv.indexOf(name);
  if (idx >= 0) return process.argv[idx + 1]?.trim();
  return undefined;
}

async function execAsSafeOwner(input: {
  safe: string;
  signer: Wallet;
  target: string;
  data: string;
  dryRun: boolean;
}): Promise<string | null> {
  if (input.dryRun) {
    console.log('[dry-run] execTransaction →', input.target, input.data.slice(0, 18) + '…');
    return null;
  }

  const safe = new Contract(input.safe, SAFE_ABI, input.signer);
  const signatures = buildSafePreValidatedSignature(await input.signer.getAddress());
  const tx = await safe.execTransaction(
    input.target,
    0,
    input.data,
    0,
    0,
    0,
    0,
    '0x0000000000000000000000000000000000000000',
    '0x0000000000000000000000000000000000000000',
    signatures
  );
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

async function ensureRecipientKyc(input: {
  token: string;
  oldTreasury: string;
  newTreasury: string;
  signer: Wallet;
  signerAddress: string;
  dryRun: boolean;
}): Promise<string | null> {
  const tokenContract = new Contract(input.token, TOKEN_ABI, input.signer.provider!);
  const approved = (await tokenContract.kycApproved(input.newTreasury)) as boolean;
  if (approved) {
    return null;
  }

  const setKycData = new Interface(TOKEN_ABI).encodeFunctionData('setKyc', [input.newTreasury, true]);
  const tokenOwner = ((await tokenContract.owner()) as string).toLowerCase();

  if (tokenOwner === input.signerAddress.toLowerCase()) {
    console.log(`[kyc] direct setKyc on ${input.token}`);
    if (input.dryRun) {
      console.log('[dry-run] setKyc →', input.newTreasury);
      return null;
    }
    const tx = await input.signer.sendTransaction({ to: input.token, data: setKycData });
    const receipt = await tx.wait();
    return receipt?.hash ?? tx.hash;
  }

  if (tokenOwner === input.oldTreasury.toLowerCase()) {
    console.log(`[kyc] Safe setKyc via ${input.oldTreasury}`);
    return execAsSafeOwner({
      safe: input.oldTreasury,
      signer: input.signer,
      target: input.token,
      data: setKycData,
      dryRun: input.dryRun
    });
  }

  throw new Error(`TOKEN_OWNER_UNSUPPORTED:${input.token}:${tokenOwner}`);
}

async function main() {
  const dryRun = readFlag('--dry-run');
  const newTreasury = readArg('--new-treasury') ?? DEFAULT_NEW_TREASURY;
  const privateKey = (process.env.TOKEN_DEPLOY_PRIVATE_KEY ?? process.env.TREASURY_OWNER_PRIVATE_KEY)?.trim();

  if (!privateKey) throw new Error('TOKEN_DEPLOY_PRIVATE_KEY required (legacy Safe owner).');
  if (!isAddress(newTreasury)) throw new Error(`Invalid new treasury: ${newTreasury}`);
  if (newTreasury.toLowerCase() === OLD_TREASURY.toLowerCase()) {
    throw new Error('New treasury must differ from old Safe.');
  }

  const rpc =
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org';

  const provider = new JsonRpcProvider(rpc);
  const signer = new Wallet(privateKey, provider);
  const signerAddress = await signer.getAddress();

  console.log('RPC:', rpc);
  console.log('Old Safe treasury:', OLD_TREASURY);
  console.log('New treasury:', newTreasury);
  console.log('Signer (legacy owner):', signerAddress);
  console.log('Mode:', dryRun ? 'DRY RUN' : 'LIVE');

  const safe = new Contract(OLD_TREASURY, SAFE_ABI, provider);
  const owners: string[] = await safe.getOwners();
  const isOwner = owners.some((o) => o.toLowerCase() === signerAddress.toLowerCase());
  if (!isOwner) {
    throw new Error(`Signer ${signerAddress} is not owner of Safe ${OLD_TREASURY}. Owners: ${owners.join(', ')}`);
  }

  for (const { name, vault, token } of VAULTS) {
    const vaultContract = new Contract(vault, VAULT_ABI, provider);
    const tokenContract = new Contract(token, TOKEN_ABI, provider);
    const shares = (await vaultContract.balanceOf(OLD_TREASURY)) as bigint;

    console.log(`\n[${name}] shares in old Safe:`, shares.toString());
    if (shares <= 0n) continue;

    const kyc = await tokenContract.kycApproved(newTreasury);
    if (!kyc) {
      console.log(`[${name}] setKyc(${newTreasury}, true)`);
      const kycHash = await ensureRecipientKyc({
        token,
        oldTreasury: OLD_TREASURY,
        newTreasury,
        signer,
        signerAddress,
        dryRun
      });
      if (kycHash) console.log(`[${name}] KYC tx:`, kycHash);
    }

    console.log(`[${name}] transfer ${shares.toString()} shares → ${newTreasury}`);
    const transferData = new Interface(VAULT_ABI).encodeFunctionData('transfer', [newTreasury, shares]);
    const txHash = await execAsSafeOwner({
      safe: OLD_TREASURY,
      signer,
      target: vault,
      data: transferData,
      dryRun
    });
    if (txHash) console.log(`[${name}] transfer tx:`, txHash);
  }

  let usdcBalance = 0n;
  try {
    const usdc = new Contract(USDC, ERC20_ABI, provider);
    usdcBalance = (await usdc.balanceOf(OLD_TREASURY)) as bigint;
    const decimals = Number(await usdc.decimals());
    console.log('\nUSDC in old Safe:', formatUnits(usdcBalance, decimals));
  } catch (error) {
    console.warn('\nUSDC balance skipped (RPC):', error instanceof Error ? error.message : error);
  }

  if (usdcBalance > 0n) {
    const transferData = new Interface(ERC20_ABI).encodeFunctionData('transfer', [newTreasury, usdcBalance]);
    const txHash = await execAsSafeOwner({
      safe: OLD_TREASURY,
      signer,
      target: USDC,
      data: transferData,
      dryRun
    });
    if (txHash) console.log('USDC sweep tx:', txHash);
  }

  if (!dryRun) {
    console.log('\n✓ Migration complete. Update env vars:');
    console.log(`  TOKEN_TREASURY_ADDRESS=${newTreasury}`);
    console.log(`  NEXT_PUBLIC_TOKEN_TREASURY_ADDRESS=${newTreasury}`);
    console.log(`  STABLECOIN_TREASURY_ADDRESS=${newTreasury}`);
    console.log(`  BASE_STABLECOIN_TREASURY_ADDRESS=${newTreasury}`);
    console.log('  ALLOW_EOA_TREASURY_IN_PRODUCTION=true  # if new treasury is Privy EOA, not Safe');
  }

  provider.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
