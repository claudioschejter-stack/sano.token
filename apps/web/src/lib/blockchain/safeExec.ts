import { Contract, type Provider, type Signer } from 'ethers';
import { buildSafePreValidatedSignature } from './safePreValidatedSignature';

export const SAFE_ABI = [
  'function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address payable refundReceiver,bytes signatures) payable returns (bool success)',
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function enableModule(address module)',
  'function isModuleEnabled(address module) view returns (bool)'
];

export async function readSafeOwners(safe: string, provider: Provider): Promise<string[]> {
  const contract = new Contract(safe, SAFE_ABI, provider);
  const owners = (await contract.getOwners()) as string[];
  return owners.map((row) => row.toLowerCase());
}

export async function readSafeThreshold(safe: string, provider: Provider): Promise<number> {
  const contract = new Contract(safe, SAFE_ABI, provider);
  return Number((await contract.getThreshold()) as bigint);
}

export async function isSafeContract(address: string, provider: Provider): Promise<boolean> {
  try {
    await readSafeOwners(address, provider);
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute `data` on `target` as the Safe using a pre-validated owner signature.
 * Only valid while the Safe threshold is 1 — higher thresholds must collect
 * signatures in the Safe UI, and this throws instead of failing on-chain.
 */
export async function execAsSafeOwner(input: {
  safe: string;
  signer: Signer;
  target: string;
  data: string;
}): Promise<string> {
  const signerAddress = await input.signer.getAddress();
  const safe = new Contract(input.safe, SAFE_ABI, input.signer);

  const owners = ((await safe.getOwners()) as string[]).map((row) => row.toLowerCase());
  if (!owners.includes(signerAddress.toLowerCase())) {
    throw new Error(`SIGNER_NOT_SAFE_OWNER:${signerAddress}`);
  }

  const threshold = Number((await safe.getThreshold()) as bigint);
  if (threshold > 1) {
    throw new Error(
      `SAFE_THRESHOLD_${threshold}: collect ${threshold} signatures in the Safe UI for this step`
    );
  }

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
    buildSafePreValidatedSignature(signerAddress)
  );
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}
