import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { assertInvestorAccessEnabled } from '../../../../lib/auth/investorAccess';
import { requireContactVerifiedUser } from '../../../../lib/onboarding/contactVerification';
import { approveDemoKycForUser } from '../../../../lib/onboarding/demoKycService';
import { allowDemoKyc } from '../../../../lib/runtime/environment';

/** Demo only — never available in production. Use Didit for real KYC. */
export async function POST() {
  try {
    if (!allowDemoKyc()) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
  } catch {
    // allowDemoKyc() throws if ALLOW_DEMO_KYC=true is detected in production.
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

  await approveDemoKycForUser(ctx.userId);

  return NextResponse.json({ ok: true });
}
