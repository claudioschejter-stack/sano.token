import { getAddress, isAddress, verifyMessage } from 'ethers';

const WALLET_LINK_TTL_MS = 10 * 60 * 1000;

export function buildWalletLinkMessage(input: {
  userId: string;
  walletAddress: string;
  issuedAt: number;
}): string {
  const normalized = getAddress(input.walletAddress).toLowerCase();
  return [
    'Sanova Capital — wallet link',
    `User: ${input.userId}`,
    `Address: ${normalized}`,
    `Issued: ${input.issuedAt}`
  ].join('\n');
}

export function createWalletLinkChallenge(userId: string, walletAddress: string) {
  if (!isAddress(walletAddress)) {
    throw new Error('INVALID_WALLET');
  }

  const issuedAt = Date.now();
  const normalized = getAddress(walletAddress).toLowerCase();
  const message = buildWalletLinkMessage({ userId, walletAddress: normalized, issuedAt });

  return { message, issuedAt, walletAddress: normalized };
}

export async function verifyWalletLinkSignature(input: {
  userId: string;
  walletAddress: string;
  issuedAt: number;
  signature: string;
}): Promise<boolean> {
  if (!isAddress(input.walletAddress)) {
    return false;
  }

  if (!Number.isFinite(input.issuedAt) || Date.now() - input.issuedAt > WALLET_LINK_TTL_MS) {
    return false;
  }

  const normalized = getAddress(input.walletAddress).toLowerCase();
  const message = buildWalletLinkMessage({
    userId: input.userId,
    walletAddress: normalized,
    issuedAt: input.issuedAt
  });

  try {
    const recovered = verifyMessage(message, input.signature.trim());
    return recovered.toLowerCase() === normalized;
  } catch {
    return false;
  }
}
