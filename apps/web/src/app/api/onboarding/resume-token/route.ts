import { NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '../../../../lib/onboarding/requireAuthenticatedSession';
import { issueResumeOnboardingToken } from '../../../../lib/onboarding/resumeOnboardingToken';
import { siteBaseUrl } from '../../../../lib/onboarding/accountActivationService';
import { safeReturnTo } from '../../../../lib/auth/redirects';

export async function POST(request: Request) {
  try {
    const ctx = await requireAuthenticatedSession();
    if (!ctx) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = (await request.json()) as { returnTo?: string };
    const returnTo = safeReturnTo(body.returnTo, '/dashboard');
    const token = await issueResumeOnboardingToken(ctx.userId, returnTo);
    const resumeUrl = `${siteBaseUrl()}/kyc/movil?resume=${encodeURIComponent(token)}`;

    return NextResponse.json({ resumeUrl });
  } catch (error) {
    console.error('[onboarding/resume-token]', error);
    return NextResponse.json({ error: 'GENERIC' }, { status: 500 });
  }
}
