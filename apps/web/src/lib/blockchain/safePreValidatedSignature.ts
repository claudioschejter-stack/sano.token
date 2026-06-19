import { getAddress } from 'ethers';

/** Pre-validated signature for Safe execTransaction when msg.sender is an owner (v=1). */
export function buildSafePreValidatedSignature(ownerAddress: string): string {
  const owner = getAddress(ownerAddress).slice(2).toLowerCase();
  return `0x${'0'.repeat(24)}${owner}${'0'.repeat(64)}01`;
}
