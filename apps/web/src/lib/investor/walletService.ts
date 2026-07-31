import { prisma } from '@sanova/database';
import { getAddress, isAddress } from 'ethers';
import { assertWalletAvailableForUser } from './linkedWalletPolicy';
import { ensureInvestorForUser } from './investorService';
import { isPendingInvestorWallet } from './provisionInvestorProfile';
import { syncUserAccountStatus } from '../onboarding/syncUserAccount';
import { sanitizeWalletProvider } from './walletDisplayName';
import { recordLinkedCryptoWallet } from './linkedWalletsService';

function normalizeWalletAddress(walletAddress: string): string {
  const trimmed = walletAddress.trim();
  if (!isAddress(trimmed)) {
    throw new Error('INVALID_WALLET');
  }
  return getAddress(trimmed).toLowerCase();
}

export type LinkUserWalletOptions = {
  /**
   * When false (default), refuse to replace an already-configured non-pending
   * wallet with a different address. Checkout must not silently rotate the
   * investor receive address from a Privy client session drift.
   */
  allowReplace?: boolean;
};

const PLATFORM_WALLET_ROLES = new Set([
  'ADMIN',
  'OPERATOR',
  'TREASURY',
  'ADVISOR',
  'ADVISOR_MANAGER',
  'INVESTOR'
]);

export async function linkUserWallet(
  userId: string,
  walletAddress: string,
  walletProvider?: string | null,
  options?: LinkUserWalletOptions
) {
  const normalized = normalizeWalletAddress(walletAddress);
  const providerLabel = sanitizeWalletProvider(walletProvider) ?? 'Coinbase Wallet';
  const allowReplace = options?.allowReplace === true;

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
      walletProvider: true,
      investorId: true,
      investorAccessEnabled: true,
      systemRole: true,
      totpEnabled: true,
      investor: { select: { walletAddress: true } }
    }
  });

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  if (!PLATFORM_WALLET_ROLES.has(user.systemRole)) {
    throw new Error('ROLE_NOT_ALLOWED');
  }

  if (user.kycStatus !== 'APPROVED') {
    throw new Error('KYC_NOT_APPROVED');
  }

  if (!user.emailVerifiedAt) {
    throw new Error('EMAIL_VERIFICATION_REQUIRED');
  }

  const existingCandidates = [user.walletAddress, user.investor?.walletAddress];
  let existing: string | null = null;
  for (const candidate of existingCandidates) {
    const trimmed = candidate?.trim();
    if (trimmed && !isPendingInvestorWallet(trimmed) && isAddress(trimmed)) {
      existing = getAddress(trimmed).toLowerCase();
      break;
    }
  }

  if (existing && existing === normalized) {
    try {
      await recordLinkedCryptoWallet({ userId, address: normalized, provider: providerLabel });
    } catch (error) {
      console.error('[linkUserWallet] recordLinkedCryptoWallet failed', error);
    }
    return {
      walletAddress: existing,
      walletProvider: user.walletProvider?.trim() || providerLabel,
      unchanged: true as const
    };
  }

  if (existing && existing !== normalized && !allowReplace) {
    throw new Error('WALLET_ALREADY_CONFIGURED');
  }

  await assertWalletAvailableForUser(userId, normalized);

  if (user.systemRole === 'INVESTOR') {
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
        walletAddress: normalized,
        investorId: user.investorId,
        investorAccessEnabled: user.investorAccessEnabled,
        systemRole: user.systemRole,
        totpEnabled: user.totpEnabled
      },
      normalized,
      providerLabel
    );
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { walletAddress: normalized, walletProvider: providerLabel }
    });
  }

  await syncUserAccountStatus(userId);

  // Best-effort: keeps a history of every wallet ever linked so the investor
  // can later pick among them (e.g. as a withdrawal destination). Never
  // blocks the primary link flow if it fails.
  try {
    await recordLinkedCryptoWallet({ userId, address: normalized, provider: providerLabel });
  } catch (error) {
    console.error('[linkUserWallet] recordLinkedCryptoWallet failed', error);
  }

  return { walletAddress: normalized, walletProvider: providerLabel };
}

/** @deprecated Use linkUserWallet */
export async function linkInvestorWallet(
  userId: string,
  walletAddress: string,
  walletProvider?: string | null
) {
  return linkUserWallet(userId, walletAddress, walletProvider);
}

export function hasLinkedWallet(walletAddress: string | null | undefined): boolean {
  return Boolean(walletAddress?.trim());
}
