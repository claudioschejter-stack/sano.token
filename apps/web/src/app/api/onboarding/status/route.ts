import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { buildOnboardingChecklist } from '../../../../lib/onboarding/accountStatus';
import { buildOnboardingProfile } from '../../../../lib/onboarding/profile';
import { isDiditConfigured } from '../../../../lib/onboarding/diditService';
import { requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';

export async function GET() {
  const ctx = await requireInvestorSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('forbidden' in ctx) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: {
      email: true,
      phone: true,
      name: true,
      kycFullName: true,
      kycDocumentId: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      kycStatus: true,
      accountStatus: true,
      diditSessionId: true,
      investor: { select: { fullName: true, cuit: true } }
    }
  });

  if (!user) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({
    checklist: buildOnboardingChecklist(user, isDiditConfigured()),
    profile: buildOnboardingProfile(user),
    diditSessionId: user.diditSessionId
  });
}
