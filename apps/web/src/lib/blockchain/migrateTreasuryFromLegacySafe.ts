import { Contract, Interface, JsonRpcProvider, Wallet, type Signer, isAddress } from 'ethers';
import { resolveMorphoLiquiditySigner } from './morphoLiquiditySigner';
import { privySafeOwnerAddress } from '../privy/config';
import { getLendingChainConfig } from '../lending/baseContracts';

const DEFAULT_OLD_TREASURY = '0x5e7480c43f99cBCc90550a16356C90793c300d52';

const VAULTS = [
  {
    name: 'uv3-old',
    vault: '0x125782B1302be9a2f58849f8A86F25F78009b367',
    token: '0x481fAa4102Fb080e8291cA49d1e70bA42d36c8F1'
  },
  {
    name: 'uv3-new',
    vault: '0x95F1359144c66C8dDFd709D7111a36CAE8bb6089',
    token: '0x1dD753e74C68E5Acfa4846D5336e7D552C999664'
  }
] as const;

const SAFE_ABI = [
  'function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address payable refundReceiver,bytes signatures) payable returns (bool success)',
  'function getOwners() view returns (address[])'
];

const TOKEN_ABI = ['function kycApproved(address) view returns (bool)', 'function setKyc(address,bool)'];
const VAULT_ABI = ['function balanceOf(address) view returns (uint256)', 'function transfer(address,uint256) returns (bool)'];

const LEGACY_GAS_TOPUP_WEI = 8_000_000_000_000_000n; // 0.008 ETH
const MIN_LEGACY_GAS_WEI = 2_000_000_000_000_000n; // 0.002 ETH

export type MigrateTreasuryResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  oldTreasury: string;
  newTreasury: string;
  legacyOwner: string;
  gasTopUpTxHash?: string;
  steps: Array<{ name: string; txHash?: string; detail?: string }>;
};

function resolveOldTreasury(): string {
  return process.env.OLD_TOKEN_TREASURY_ADDRESS?.trim() || DEFAULT_OLD_TREASURY;
}

function resolveNewTreasury(): string | null {
  return (
    process.env.NEW_TOKEN_TREASURY_ADDRESS?.trim() ||
    privySafeOwnerAddress()?.trim() ||
    process.env.TREASURY_OWNER_ADDRESS?.trim() ||
    null
  );
}

function resolveLegacyPrivateKey(): string | null {
  return (
    process.env.TOKEN_DEPLOY_PRIVATE_KEY?.trim() ||
    process.env.TREASURY_OWNER_PRIVATE_KEY?.trim() ||
    null
  );
}

async function execAsSafeOwner(input: {
  safe: string;
  signer: Signer;
  target: string;
  data: string;
}): Promise<string> {
  const safe = new Contract(input.safe, SAFE_ABI, input.signer);
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
    '0x'
  );
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

export async function migrateTreasuryFromLegacySafe(): Promise<MigrateTreasuryResult> {
  const oldTreasury = resolveOldTreasury();
  const newTreasury = resolveNewTreasury();
  const privateKey = resolveLegacyPrivateKey();
  const steps: MigrateTreasuryResult['steps'] = [];

  if (!newTreasury || !isAddress(newTreasury)) {
    return {
      ok: false,
      oldTreasury,
      newTreasury: newTreasury ?? '',
      legacyOwner: '',
      steps,
      reason: 'NEW_TREASURY_NOT_CONFIGURED'
    };
  }

  if (oldTreasury.toLowerCase() === newTreasury.toLowerCase()) {
    return {
      ok: true,
      skipped: true,
      reason: 'ALREADY_MIGRATED',
      oldTreasury,
      newTreasury,
      legacyOwner: '',
      steps
    };
  }

  if (!privateKey) {
    return {
      ok: false,
      oldTreasury,
      newTreasury,
      legacyOwner: '',
      steps,
      reason: 'LEGACY_PRIVATE_KEY_MISSING'
    };
  }

  const rpc =
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org';
  const chainId = getLendingChainConfig().chainId;
  const provider = new JsonRpcProvider(rpc);

  try {
    const legacySigner = new Wallet(privateKey, provider);
    const legacyOwner = await legacySigner.getAddress();

    const safeRead = new Contract(oldTreasury, SAFE_ABI, provider);
    const owners: string[] = await safeRead.getOwners();
    const isOwner = owners.some((o) => o.toLowerCase() === legacyOwner.toLowerCase());
    if (!isOwner) {
      return {
        ok: false,
        oldTreasury,
        newTreasury,
        legacyOwner,
        steps,
        reason: `LEGACY_NOT_SAFE_OWNER:${owners.join(',')}`
      };
    }

    let totalSharesToMove = 0n;
    for (const { vault } of VAULTS) {
      const vaultContract = new Contract(vault, VAULT_ABI, provider);
      totalSharesToMove += (await vaultContract.balanceOf(oldTreasury)) as bigint;
    }

    if (totalSharesToMove <= 0n) {
      return {
        ok: true,
        skipped: true,
        reason: 'NO_SHARES_IN_OLD_TREASURY',
        oldTreasury,
        newTreasury,
        legacyOwner,
        steps
      };
    }

    const legacyBalance = await provider.getBalance(legacyOwner);
    if (legacyBalance < MIN_LEGACY_GAS_WEI) {
      const morphoSigner = await resolveMorphoLiquiditySigner(provider, chainId);
      if (!morphoSigner) {
        return {
          ok: false,
          oldTreasury,
          newTreasury,
          legacyOwner,
          steps,
          reason: 'MORPHO_SIGNER_MISSING_FOR_GAS_TOPUP'
        };
      }

      const morphoAddress = await morphoSigner.getAddress();
      const morphoBalance = await provider.getBalance(morphoAddress);
      if (morphoBalance <= LEGACY_GAS_TOPUP_WEI) {
        return {
          ok: false,
          oldTreasury,
          newTreasury,
          legacyOwner,
          steps,
          reason: 'MORPHO_WALLET_INSUFFICIENT_ETH'
        };
      }

      const topUpTx = await morphoSigner.sendTransaction({
        to: legacyOwner,
        value: LEGACY_GAS_TOPUP_WEI
      });
      const topUpReceipt = await topUpTx.wait();
      const gasTopUpTxHash = topUpReceipt?.hash ?? topUpTx.hash;
      steps.push({ name: 'gas_topup', txHash: gasTopUpTxHash, detail: morphoAddress });
    }

    for (const { name, vault, token } of VAULTS) {
      const vaultContract = new Contract(vault, VAULT_ABI, provider);
      const tokenContract = new Contract(token, TOKEN_ABI, provider);
      const shares = (await vaultContract.balanceOf(oldTreasury)) as bigint;
      if (shares <= 0n) {
        steps.push({ name: `${name}_skip`, detail: 'no shares' });
        continue;
      }

      const kyc = await tokenContract.kycApproved(newTreasury);
      if (!kyc) {
        const setKycData = new Interface(TOKEN_ABI).encodeFunctionData('setKyc', [newTreasury, true]);
        const kycHash = await execAsSafeOwner({
          safe: oldTreasury,
          signer: legacySigner,
          target: token,
          data: setKycData
        });
        steps.push({ name: `${name}_kyc`, txHash: kycHash });
      }

      const transferData = new Interface(VAULT_ABI).encodeFunctionData('transfer', [newTreasury, shares]);
      const transferHash = await execAsSafeOwner({
        safe: oldTreasury,
        signer: legacySigner,
        target: vault,
        data: transferData
      });
      steps.push({ name: `${name}_transfer`, txHash: transferHash, detail: shares.toString() });
    }

    return {
      ok: true,
      oldTreasury,
      newTreasury,
      legacyOwner,
      gasTopUpTxHash: steps.find((s) => s.name === 'gas_topup')?.txHash,
      steps
    };
  } finally {
    provider.destroy();
  }
}
