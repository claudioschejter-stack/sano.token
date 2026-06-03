import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { buildOnboardingChecklist } from '../../../../lib/onboarding/accountStatus';
import { buildOnboardingProfile } from '../../../../lib/onboarding/profile';
import { getOnboardingIntegrations } from '../../../../lib/onboarding/integrationStatus';
import { isDiditConfigured } from '../../../../lib/onboarding/diditService';
import { requireAuthenticatedSession } from '../../../../lib/onboarding/requireAuthenticatedSession';
import { syncUserAccountStatus } from '../../../../lib/onboarding/syncUserAccount';

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
      systemRole: true,
      diditSessionId: true,
      investor: { select: { fullName: true, cuit: true, walletAddress: true } }
    }
  });

  if (!user) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const walletAddress = user.walletAddress ?? user.investor?.walletAddress ?? null;

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
        systemRole: user.systemRole
      },
      isDiditConfigured()
    ),
    profile: buildOnboardingProfile(user),
    diditSessionId: user.diditSessionId,
    integrations: getOnboardingIntegrations(),
    systemRole: user.systemRole
  });
}
