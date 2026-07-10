import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { safeReturnTo } from '../../../../../lib/auth/redirects';
import { buildKycUrl, DEFAULT_POST_ONBOARDING_PATH } from '../../../../../lib/auth/kycPaths';
import {
  createDiditSession,
  isDiditConfigured,
  parseDiditSessionError
} from '../../../../../lib/onboarding/diditService';
import { requireContactVerifiedUser } from '../../../../../lib/onboarding/contactVerification';
import { siteBaseUrl } from '../../../../../lib/onboarding/accountActivationService';

export async function POST(request: Request) {
  const ctx = await requireContactVerifiedUser();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('contactRequired' in ctx) {
    return NextResponse.json({ error: 'CONTACT_NOT_VERIFIED' }, { status: 403 });
  }

  if (!isDiditConfigured()) {
    return NextResponse.json({ error: 'DIDIT_NOT_CONFIGURED' }, { status: 503 });
  }

  let returnTo = DEFAULT_POST_ONBOARDING_PATH;
  try {
    const body = (await request.json()) as { returnTo?: string };
    returnTo = safeReturnTo(body.returnTo, DEFAULT_POST_ONBOARDING_PATH);
  } catch {
    /* optional body */
  }

  const kycReturnPath = buildKycUrl(returnTo, DEFAULT_POST_ONBOARDING_PATH, undefined, {
    registered: true
  });
  const callbackUrl = `${siteBaseUrl()}${kycReturnPath}${kycReturnPath.includes('?') ? '&' : '?'}didit=1`;

  if (!/^https?:\/\//i.test(callbackUrl)) {
    console.error('[onboarding/didit/session] invalid callback url', callbackUrl);
    return NextResponse.json({ error: 'DIDIT_CALLBACK_INVALID' }, { status: 500 });
  }

  const userForLocale = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { preferredLocale: true }
  });

  try {
    const session = await createDiditSession({
      userId: ctx.userId,
      callbackUrl,
      locale: userForLocale?.preferredLocale
    });

    await prisma.user.update({
      where: { id: ctx.userId },
      data: {
        diditSessionId: session.sessionId,
        kycProviderId: session.sessionId
      }
    });

    return NextResponse.json({
      sessionId: session.sessionId,
      url: session.url
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    const parsed = parseDiditSessionError(message);
    console.error('[onboarding/didit/session]', {
      userId: ctx.userId,
      callbackUrl,
      errorCode: parsed.code,
      httpStatus: parsed.httpStatus,
      diditMessage: parsed.diditMessage,
      detailPreview: parsed.detailPreview
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
