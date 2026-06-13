import { prisma } from '@sanova/database';

export const PENDING_INVESTOR_WALLET_PREFIX = 'pending:';

export function buildPendingInvestorWalletAddress(userId: string): string {
  return `${PENDING_INVESTOR_WALLET_PREFIX}${userId}`.toLowerCase();
}

export function isPendingInvestorWallet(walletAddress: string | null | undefined): boolean {
  return Boolean(walletAddress?.toLowerCase().startsWith(PENDING_INVESTOR_WALLET_PREFIX));
}

/** User-linked wallet for operational checks; ignores investor `pending:*` placeholders. */
export function resolveOperationalWalletAddress(
  userWallet: string | null | undefined,
  investorWallet: string | null | undefined
): string | null {
  for (const candidate of [userWallet, investorWallet]) {
    const trimmed = candidate?.trim();
    if (trimmed && !isPendingInvestorWallet(trimmed)) {
      return trimmed;
    }
  }

  return null;
}

/**
 * Creates Investor + Portfolio when KYC is approved for an INVESTOR user.
 * Uses a deterministic pending wallet until the user links an on-chain address.
 */
export async function provisionInvestorProfileOnKycApproval(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      kycFullName: true,
      kycDocumentId: true,
      kycStatus: true,
      systemRole: true,
      investorId: true,
      walletAddress: true
    }
  });

  if (!user || user.kycStatus !== 'APPROVED' || user.systemRole !== 'INVESTOR') {
    return null;
  }

  if (user.investorId) {
    await prisma.investor.update({
      where: { id: user.investorId },
      data: {
        kycStatus: 'APPROVED',
        kycVerifiedAt: new Date()
      }
    });

    await prisma.portfolio.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {}
    });

    return user.investorId;
  }

  const fullName = user.kycFullName?.trim() || user.email.split('@')[0];
  const cuit = user.kycDocumentId?.trim() || `TMP-${user.id.slice(0, 8)}`;
  const linkedWallet = user.walletAddress?.trim().toLowerCase();
  const walletAddress = linkedWallet || buildPendingInvestorWalletAddress(user.id);
  const now = new Date();

  const investor = await prisma.investor.create({
    data: {
      email: user.email,
      fullName,
      cuit,
      walletAddress,
      kycStatus: 'APPROVED',
      kycVerifiedAt: now
    }
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { investorId: investor.id }
  });

  await prisma.portfolio.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {}
  });

  return investor.id;
}
