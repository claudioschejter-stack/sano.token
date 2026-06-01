import { prisma } from '@sanova/database';
import { getAddress, isAddress } from 'ethers';
import { BASE_CHAIN_ID } from '../web3/config';

export function normalizeLinkedWalletAddress(walletAddress: string): string {
  const trimmed = walletAddress.trim();
  if (!isAddress(trimmed)) {
    throw new Error('INVALID_WALLET');
  }
  return getAddress(trimmed).toLowerCase();
}

export async function getLinkedWalletForUser(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      walletAddress: true,
      investor: { select: { walletAddress: true } }
    }
  });

  const linked = user?.walletAddress?.trim() || user?.investor?.walletAddress?.trim() || null;
  return linked ? normalizeLinkedWalletAddress(linked) : null;
}

export async function assertWalletAvailableForUser(userId: string, walletAddress: string): Promise<void> {
  const normalized = normalizeLinkedWalletAddress(walletAddress);

  const ownerUser = await prisma.user.findFirst({
    where: {
      walletAddress: normalized,
      NOT: { id: userId }
    },
    select: { id: true }
  });

  if (ownerUser) {
    throw new Error('WALLET_ALREADY_LINKED');
  }

  const ownerInvestor = await prisma.investor.findFirst({
    where: {
      walletAddress: normalized,
      NOT: { user: { id: userId } }
    },
    select: { id: true }
  });

  if (ownerInvestor) {
    throw new Error('WALLET_ALREADY_LINKED');
  }
}

export function assertConnectedMatchesLinked(linkedWallet: string, connectedWallet?: string | null): void {
  if (!connectedWallet?.trim()) {
    throw new Error('WALLET_REQUIRED');
  }

  const linked = normalizeLinkedWalletAddress(linkedWallet);
  const connected = normalizeLinkedWalletAddress(connectedWallet);

  if (linked !== connected) {
    throw new Error('WALLET_MISMATCH');
  }
}

export function assertBaseChain(chainId?: number | null): void {
  if (chainId == null || chainId !== BASE_CHAIN_ID) {
    throw new Error('CHAIN_MISMATCH');
  }
}

/** Returns the DB-linked wallet; optionally validates it matches the connected session wallet. */
export async function resolveInvestorLinkedWallet(
  userId: string,
  connectedWallet?: string | null
): Promise<string> {
  const linked = await getLinkedWalletForUser(userId);

  if (!linked) {
    throw new Error('INVESTOR_WALLET_REQUIRED');
  }

  if (connectedWallet != null && connectedWallet !== '') {
    assertConnectedMatchesLinked(linked, connectedWallet);
  }

  return linked;
}
