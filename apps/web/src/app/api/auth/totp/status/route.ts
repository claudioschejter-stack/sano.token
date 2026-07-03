import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { prisma } from '@sanova/database';
import { requiresInvestorStyleOnboarding } from '../../../../../lib/onboarding/onboardingGate';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ totpEnabled: false, totpMandatory: false });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpEnabled: true, totpSecret: true, kycStatus: true, systemRole: true }
  });

  const totpMandatory =
    Boolean(user?.totpEnabled) &&
    user?.kycStatus === 'APPROVED' &&
    requiresInvestorStyleOnboarding(user.systemRole);

  return NextResponse.json({
    totpEnabled: user?.totpEnabled ?? false,
    totpMandatory,
    pendingSetup: Boolean(user?.totpSecret && !user?.totpEnabled)
  });
}
