import { prisma } from '@sanova/database';
import { getAddress, isAddress } from 'ethers';
import { assertWalletAvailableForUser } from './linkedWalletPolicy';
import { ensureInvestorForUser } from './investorService';

function normalizeWalletAddress(walletAddress: string): string {
  const trimmed = walletAddress.trim();
  if (!isAddress(trimmed)) {
    throw new Error('INVALID_WALLET');
  }
  return getAddress(trimmed).toLowerCase();
}

export async function linkInvestorWallet(userId: string, walletAddress: string) {
  const normalized = normalizeWalletAddress(walletAddress);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      kycFullName: true,
      kycDocumentId: true,
      kycStatus: true,
      accountStatus: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      walletAddress: true,
      investorId: true,
      systemRole: true
    }
  });

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  if (user.kycStatus !== 'APPROVED') {
    throw new Error('KYC_NOT_APPROVED');
  }

  if (user.systemRole !== 'INVESTOR') {
    throw new Error('INVESTOR_ROLE_REQUIRED');
  }

  await assertWalletAvailableForUser(userId, normalized);

  await ensureInvestorForUser(
    {
      id: user.id,
      email: user.email,
      phone: user.phone,
      kycFullName: user.kycFullName,
      kycDocumentId: user.kycDocumentId,
      kycStatus: user.kycStatus,
      accountStatus: user.accountStatus,
      emailVerifiedAt: user.emailVerifiedAt,
      phoneVerifiedAt: user.phoneVerifiedAt,
      walletAddress: user.walletAddress,
      investorId: user.investorId
    },
    normalized
  );

  return { walletAddress: normalized };
}

export function hasLinkedWallet(walletAddress: string | null | undefined): boolean {
  return Boolean(walletAddress?.trim());
}
