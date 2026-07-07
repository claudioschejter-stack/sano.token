import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { verifyResumeOnboardingToken } from '../../../../lib/onboarding/resumeOnboardingToken';

function authSecret(): Uint8Array {
  const secret =
    process.env.AUTH_INTERNAL_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim();

  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET_NOT_CONFIGURED');
  }

  return new TextEncoder().encode(secret);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { resume?: string };
    const resume = body.resume?.trim();

    if (!resume) {
      return NextResponse.json({ error: 'INVALID_OR_EXPIRED_TOKEN' }, { status: 400 });
    }

    const parsed = await verifyResumeOnboardingToken(resume);
    if (!parsed) {
      return NextResponse.json({ error: 'INVALID_OR_EXPIRED_TOKEN' }, { status: 400 });
    }

    const loginToken = await new SignJWT({ purpose: 'activation-login' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(parsed.userId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(authSecret());

    return NextResponse.json({
      loginToken,
      returnTo: parsed.returnTo
    });
  } catch (error) {
    console.error('[onboarding/resume-session]', error);
    return NextResponse.json({ error: 'GENERIC' }, { status: 500 });
  }
}
