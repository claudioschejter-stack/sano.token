import { prisma } from '@sanova/database';
import { applyInvestorInviteAdvisorForUser } from '../invite/applyInvestorInviteAdvisor';
import { isCuitUniqueConflict, resolveOrphanedInvestorByCuit } from './investorCuitConflict';
import { pregenerateOrFetchPrivyWallet } from '../privy/privyWalletProvisioning';
import { syncUserAccountStatus } from '../onboarding/syncUserAccount';

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

function buildInvestorIdentityFields(user: {
  email: string;
  phone: string | null;
  kycFullName: string | null;
  kycDocumentId: string | null;
  kycDateOfBirth: string | null;
  kycNationality: string | null;
  kycPortraitPath: string | null;
  image: string | null;
}) {
  return {
    fullName: user.kycFullName?.trim() || user.email.split('@')[0],
    cuit: user.kycDocumentId?.trim() || undefined,
    phone: user.phone?.trim() || null,
    dateOfBirth: user.kycDateOfBirth?.trim() || null,
    nationality: user.kycNationality?.trim() || null,
    portraitPath: user.kycPortraitPath?.trim() || user.image?.trim() || null
  };
}

/**
 * Server-side safety net: if the investor still has the `pending:*` placeholder
 * wallet, pre-generate a real Privy embedded wallet by email and persist it —
 * without waiting for the user to open the "Configurá pagos" onboarding step.
 * Best-effort: never throws, so a Privy hiccup never blocks KYC approval (the
 * client-driven wallet step remains as a fallback either way).
 */
async function backfillPrivyWalletIfPending(userId: string, investorId: string, email: string): Promise<void> {
  try {
    const investor = await prisma.investor.findUnique({
      where: { id: investorId },
      select: { walletAddress: true }
    });

    if (investor?.walletAddress && !isPendingInvestorWallet(investor.walletAddress)) {
      return;
    }

    const address = await pregenerateOrFetchPrivyWallet(email);
    if (!address) {
      return;
    }

    await prisma.$transaction([
      prisma.investor.update({ where: { id: investorId }, data: { walletAddress: address } }),
      prisma.user.update({
        where: { id: userId },
        data: { walletAddress: address, walletProvider: 'Privy Wallet' }
      })
    ]);

    await syncUserAccountStatus(userId);
  } catch (error) {
    console.error('[provisionInvestorProfile] backfillPrivyWalletIfPending failed', error);
  }
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
      phone: true,
      image: true,
      kycFullName: true,
      kycDocumentId: true,
      kycDateOfBirth: true,
      kycNationality: true,
      kycPortraitPath: true,
      kycStatus: true,
      systemRole: true,
      investorId: true,
      walletAddress: true
    }
  });

  if (!user || user.kycStatus !== 'APPROVED') {
    return null;
  }

  const tradingRoles = new Set(['INVESTOR', 'ADVISOR', 'ADVISOR_MANAGER']);
  if (!tradingRoles.has(user.systemRole)) {
    return null;
  }

  const identity = buildInvestorIdentityFields(user);
  const now = new Date();

  if (user.investorId) {
    await prisma.investor.update({
      where: { id: user.investorId },
      data: {
        fullName: identity.fullName,
        ...(identity.cuit ? { cuit: identity.cuit } : {}),
        phone: identity.phone,
        dateOfBirth: identity.dateOfBirth,
        nationality: identity.nationality,
        portraitPath: identity.portraitPath,
        kycStatus: 'APPROVED',
        kycVerifiedAt: now
      }
    });

    await prisma.portfolio.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {}
    });

    if (user.systemRole === 'INVESTOR') {
      await applyInvestorInviteAdvisorForUser(user.id, user.email);
    }

    await backfillPrivyWalletIfPending(user.id, user.investorId, user.email);

    return user.investorId;
  }

  const linkedWallet = user.walletAddress?.trim().toLowerCase();
  const walletAddress = linkedWallet || buildPendingInvestorWalletAddress(user.id);
  const cuit = identity.cuit || `TMP-${user.id.slice(0, 8)}`;

  let investorId: string;
  try {
    const investor = await prisma.investor.create({
      data: {
        email: user.email,
        fullName: identity.fullName,
        cuit,
        phone: identity.phone,
        dateOfBirth: identity.dateOfBirth,
        nationality: identity.nationality,
        portraitPath: identity.portraitPath,
        walletAddress,
        kycStatus: 'APPROVED',
        kycVerifiedAt: now
      }
    });
    investorId = investor.id;
  } catch (error) {
    if (!isCuitUniqueConflict(error)) {
      throw error;
    }
    // Same identity document already has an Investor row. Adopt it if it's an
    // orphaned record (no owning user); otherwise this is a genuine duplicate
    // identity across two accounts and callers must surface a clear message.
    investorId = await resolveOrphanedInvestorByCuit(cuit, user.id);
    await prisma.investor.update({
      where: { id: investorId },
      data: {
        fullName: identity.fullName,
        phone: identity.phone,
        dateOfBirth: identity.dateOfBirth,
        nationality: identity.nationality,
        portraitPath: identity.portraitPath,
        walletAddress,
        kycStatus: 'APPROVED',
        kycVerifiedAt: now
      }
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { investorId }
  });

  if (user.systemRole === 'INVESTOR') {
    await applyInvestorInviteAdvisorForUser(user.id, user.email);
  }

  await prisma.portfolio.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {}
  });

  await backfillPrivyWalletIfPending(user.id, investorId, user.email);

  return investorId;
}
