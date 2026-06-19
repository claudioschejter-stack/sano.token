import { AbiCoder, Contract, Interface, keccak256, type Signer } from 'ethers';
import { buildSafePreValidatedSignature } from './safePreValidatedSignature';

const ADMIN_ABI = [
  'function adminActionReadyAt(bytes32) view returns (uint256)',
  'function scheduleAdminAction(bytes32 actionId)',
  'function setKyc(address account, bool approved)',
  'function setExternalContractAllowed(address account, bool allowed)',
  'function kycApproved(address) view returns (bool)',
  'function externalContractAllowed(address) view returns (bool)'
];

const SAFE_ABI = [
  'function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address payable refundReceiver,bytes signatures) payable returns (bool success)'
];

export type AllowlistActionKind = 'SET_KYC' | 'SET_EXTERNAL_CONTRACT_ALLOWED';

export type AllowlistStep = {
  label: string;
  contractAddress: string;
  kind: AllowlistActionKind;
  executeVia: 'legacy' | 'safe';
};

export function buildAdminActionId(kind: AllowlistActionKind, account: string, allowed: boolean): string {
  return keccak256(AbiCoder.defaultAbiCoder().encode(['string', 'address', 'bool'], [kind, account, allowed]));
}

function encodeAdminCall(kind: AllowlistActionKind, account: string, allowed: boolean): string {
  const iface = new Interface(ADMIN_ABI);
  if (kind === 'SET_KYC') {
    return iface.encodeFunctionData('setKyc', [account, allowed]);
  }
  return iface.encodeFunctionData('setExternalContractAllowed', [account, allowed]);
}

async function sendContractCall(input: {
  to: string;
  data: string;
  executeVia: 'legacy' | 'safe';
  legacySigner: Signer;
  safeAddress: string;
}): Promise<string> {
  if (input.executeVia === 'legacy') {
    const tx = await input.legacySigner.sendTransaction({ to: input.to, data: input.data });
    const receipt = await tx.wait();
    return receipt?.hash ?? tx.hash;
  }

  const signerAddress = await input.legacySigner.getAddress();
  const safe = new Contract(input.safeAddress, SAFE_ABI, input.legacySigner);
  const tx = await safe.execTransaction(
    input.to,
    0,
    input.data,
    0,
    0,
    0,
    0,
    '0x0000000000000000000000000000000000000000',
    '0x0000000000000000000000000000000000000000',
    buildSafePreValidatedSignature(signerAddress)
  );
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

async function isAllowlistSatisfied(
  contractAddress: string,
  kind: AllowlistActionKind,
  account: string,
  allowed: boolean,
  signer: Signer
): Promise<boolean> {
  const contract = new Contract(contractAddress, ADMIN_ABI, signer.provider!);
  if (kind === 'SET_KYC') {
    return (await contract.kycApproved(account)) === allowed;
  }
  return (await contract.externalContractAllowed(account)) === allowed;
}

export async function ensureTreasuryAllowlist(input: {
  steps: AllowlistStep[];
  recipient: string;
  legacySigner: Signer;
  safeAddress: string;
}): Promise<{ steps: Array<{ label: string; txHash?: string; detail: string }>; pending: string[] }> {
  const out: Array<{ label: string; txHash?: string; detail: string }> = [];
  const pending: string[] = [];
  const now = Math.floor(Date.now() / 1000);
  const scheduleDataFor = (actionId: string) =>
    new Interface(ADMIN_ABI).encodeFunctionData('scheduleAdminAction', [actionId]);
  const pause = () => new Promise((resolve) => setTimeout(resolve, 4000));

  for (const step of input.steps) {
    await pause();
    const actionId = buildAdminActionId(step.kind, input.recipient, true);
    const contract = new Contract(step.contractAddress, ADMIN_ABI, input.legacySigner.provider!);

    if (await isAllowlistSatisfied(step.contractAddress, step.kind, input.recipient, true, input.legacySigner)) {
      out.push({ label: step.label, detail: 'already allowed' });
      continue;
    }

    const readyAt = (await contract.adminActionReadyAt(actionId)) as bigint;
    if (readyAt === 0n) {
      const txHash = await sendContractCall({
        to: step.contractAddress,
        data: scheduleDataFor(actionId),
        executeVia: step.executeVia,
        legacySigner: input.legacySigner,
        safeAddress: input.safeAddress
      });
      out.push({
        label: `${step.label}_schedule`,
        txHash,
        detail: 'timelock scheduled (+24h)'
      });
      pending.push(`${step.label}: waiting timelock`);
      continue;
    }

    if (Number(readyAt) > now) {
      pending.push(`${step.label}: ready at ${new Date(Number(readyAt) * 1000).toISOString()}`);
      out.push({
        label: step.label,
        detail: `timelock pending until ${new Date(Number(readyAt) * 1000).toISOString()}`
      });
      continue;
    }

    const txHash = await sendContractCall({
      to: step.contractAddress,
      data: encodeAdminCall(step.kind, input.recipient, true),
      executeVia: step.executeVia,
      legacySigner: input.legacySigner,
      safeAddress: input.safeAddress
    });
    out.push({ label: step.label, txHash, detail: 'executed' });
  }

  return { steps: out, pending };
}

export function buildVaultAllowlistSteps(input: {
  name: string;
  token: string;
  vault: string;
  tokenOwner: string;
  vaultOwner: string;
  oldSafe: string;
}): AllowlistStep[] {
  const tokenVia: 'legacy' | 'safe' =
    input.tokenOwner.toLowerCase() === input.oldSafe.toLowerCase() ? 'safe' : 'legacy';
  const vaultVia: 'legacy' | 'safe' =
    input.vaultOwner.toLowerCase() === input.oldSafe.toLowerCase() ? 'safe' : 'legacy';

  return [
    {
      label: `${input.name}_token_kyc`,
      contractAddress: input.token,
      kind: 'SET_KYC',
      executeVia: tokenVia
    },
    {
      label: `${input.name}_token_external`,
      contractAddress: input.token,
      kind: 'SET_EXTERNAL_CONTRACT_ALLOWED',
      executeVia: tokenVia
    },
    {
      label: `${input.name}_vault_external`,
      contractAddress: input.vault,
      kind: 'SET_EXTERNAL_CONTRACT_ALLOWED',
      executeVia: vaultVia
    }
  ];
}
