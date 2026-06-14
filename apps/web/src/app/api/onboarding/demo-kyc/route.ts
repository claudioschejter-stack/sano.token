import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { assertInvestorAccessEnabled } from '../../../../lib/auth/investorAccess';
import { requireContactVerifiedUser } from '../../../../lib/onboarding/contactVerification';
import { syncUserAccountStatus } from '../../../../lib/onboarding/syncUserAccount';
import { provisionInvestorProfileOnKycApproval } from '../../../../lib/investor/provisionInvestorProfile';

/** Demo only — use Didit in production. */
export async function POST() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_KYC !== 'true') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const ctx = await requireContactVerifiedUser();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('contactRequired' in ctx) {
    return NextResponse.json({ error: 'CONTACT_NOT_VERIFIED' }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { systemRole: true, investorAccessEnabled: true }
  });

  if (!user || user.systemRole !== 'INVESTOR') {
    return NextResponse.json({ error: 'ROLE_NOT_ALLOWED' }, { status: 403 });
  }

  try {
    assertInvestorAccessEnabled(user);
  } catch {
    return NextResponse.json({ error: 'INVESTOR_ACCESS_NOT_ENABLED' }, { status: 403 });
  }

  await prisma.user.update({
    where: { id: ctx.userId },
    data: { kycStatus: 'APPROVED' }
  });

  await syncUserAccountStatus(ctx.userId);
  await provisionInvestorProfileOnKycApproval(ctx.userId);

  return NextResponse.json({ ok: true });
}
