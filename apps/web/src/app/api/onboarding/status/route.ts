import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { resolveOperationalWalletAddress } from '../../../../lib/investor/provisionInvestorProfile';
import { buildOnboardingChecklist } from '../../../../lib/onboarding/accountStatus';
import { buildOnboardingProfile } from '../../../../lib/onboarding/profile';
import { getOnboardingIntegrations } from '../../../../lib/onboarding/integrationStatus';
import { isDiditConfigured } from '../../../../lib/onboarding/diditService';
import { requireAuthenticatedSession } from '../../../../lib/onboarding/requireAuthenticatedSession';
import { syncUserAccountStatus } from '../../../../lib/onboarding/syncUserAccount';
import { resolveInvestorInvitePhoneForEmail } from '../../../../lib/admin/investorInviteService';

export async function GET() {
  const ctx = await requireAuthenticatedSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: {
      email: true,
      phone: true,
      name: true,
      kycFullName: true,
      kycDocumentId: true,
      kycDateOfBirth: true,
      kycNationality: true,
      kycDocumentType: true,
      kycDocumentExpiry: true,
      kycGender: true,
      jurisdiction: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      kycStatus: true,
      accountStatus: true,
      walletAddress: true,
      walletProvider: true,
      systemRole: true,
      diditSessionId: true,
      totpEnabled: true,
      registrationChannel: true,
      onboardingSuccessShownAt: true,
      investor: { select: { fullName: true, cuit: true, walletAddress: true } }
    }
  });

  if (!user) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const walletAddress = resolveOperationalWalletAddress(
    user.walletAddress,
    user.investor?.walletAddress
  );

  const suggestedPhone = user.phone?.trim()
    ? null
    : await resolveInvestorInvitePhoneForEmail(user.email);

  const profile = buildOnboardingProfile(user);
  if (suggestedPhone) {
    profile.suggestedPhone = suggestedPhone;
  }

  return NextResponse.json({
    checklist: buildOnboardingChecklist(
      {
        email: user.email,
        phone: user.phone,
        emailVerifiedAt: user.emailVerifiedAt,
        phoneVerifiedAt: user.phoneVerifiedAt,
        kycStatus: user.kycStatus,
        accountStatus: user.accountStatus,
        walletAddress,
        walletProvider: user.walletProvider,
        systemRole: user.systemRole,
        totpEnabled: user.totpEnabled
      },
      isDiditConfigured()
    ),
    profile,
    diditSessionId: user.diditSessionId,
    integrations: getOnboardingIntegrations(),
    systemRole: user.systemRole,
    registrationChannel: user.registrationChannel,
    onboardingSuccessShownAt: user.onboardingSuccessShownAt
  });
}
