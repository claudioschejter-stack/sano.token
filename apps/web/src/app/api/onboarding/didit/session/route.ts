import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { createDiditSession, isDiditConfigured } from '../../../../../lib/onboarding/diditService';
import { requireContactVerifiedUser } from '../../../../../lib/onboarding/contactVerification';

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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
  const callbackUrl = `${siteUrl}/acceso/callback`;

  try {
    const session = await createDiditSession({
      userId: ctx.userId,
      callbackUrl
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
    console.error('[onboarding/didit/session]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
