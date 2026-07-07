import { SignJWT, jwtVerify } from 'jose';

const RESUME_TTL = '24h';

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

export async function issueResumeOnboardingToken(userId: string, returnTo: string): Promise<string> {
  return new SignJWT({ purpose: 'resume-onboarding', returnTo })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(RESUME_TTL)
    .sign(authSecret());
}

export async function verifyResumeOnboardingToken(token: string): Promise<{ userId: string; returnTo: string } | null> {
  try {
    const verified = await jwtVerify(token.trim(), authSecret());
    const purpose = verified.payload.purpose;
    const sub = verified.payload.sub;
    const returnTo = verified.payload.returnTo;

    if (
      purpose !== 'resume-onboarding' ||
      typeof sub !== 'string' ||
      !sub.trim() ||
      typeof returnTo !== 'string'
    ) {
      return null;
    }

    return { userId: sub, returnTo };
  } catch {
    return null;
  }
}
