import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '@sanova/database';
import { sendTransactionalEmail } from '../email/sendTransactionalEmail';
import { renderEmailShell, renderEmailButton } from '../email/emailTemplate';
import { getEmailMessages } from '../email/emailMessages';
import { normalizeEmail } from './contactValidation';

const MIN_PASSWORD_LENGTH = 8;
const TOKEN_TTL = '1h';

function resetSecret(): Uint8Array {
  const secret =
    process.env.AUTH_INTERNAL_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET_NOT_CONFIGURED');
  }
  return new TextEncoder().encode(secret);
}

function siteBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://sano-token-web.vercel.app')
  ).replace(/\/$/, '');
}

export async function requestPasswordReset(
  email: string
): Promise<{ ok: true; devResetUrl?: string }> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { ok: true };
  }

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, email: true, passwordHash: true, preferredLocale: true }
  });

  if (!user?.passwordHash) {
    return { ok: true };
  }

  const token = await new SignJWT({ purpose: 'password-reset' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(resetSecret());

  const resetUrl = `${siteBaseUrl()}/acceso/restablecer?token=${encodeURIComponent(token)}`;
  const m = getEmailMessages(user.preferredLocale);

  const result = await sendTransactionalEmail({
    to: user.email,
    subject: m.passwordReset.subject,
    text: [
      m.passwordReset.intro,
      '',
      `${m.passwordReset.cta}: ${resetUrl}`,
      '',
      m.passwordReset.expiry,
      '',
      m.common.brand
    ].join('\n'),
    html: renderEmailShell({
      locale: user.preferredLocale,
      bodyHtml: `
        <p>${m.passwordReset.intro}</p>
        ${renderEmailButton(resetUrl, m.passwordReset.cta)}
        <p style="color:#475569;font-size:14px">${m.passwordReset.expiry}</p>
      `
    })
  });

  const exposeDev =
    process.env.ONBOARDING_DEV_EXPOSE_CODE === 'true' || process.env.NODE_ENV !== 'production';

  if (!result.ok) {
    console.warn('[password-reset] email delivery failed for', user.email, result.error);
    if (exposeDev) {
      console.info('[password-reset] dev reset url:', resetUrl);
      return { ok: true, devResetUrl: resetUrl };
    }
  }

  return { ok: true };
}

export async function resetPasswordWithToken(token: string, password: string): Promise<void> {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error('WEAK_PASSWORD');
  }

  let userId: string;

  try {
    const verified = await jwtVerify(token.trim(), resetSecret());
    const purpose = verified.payload.purpose;
    const sub = verified.payload.sub;

    if (purpose !== 'password-reset' || typeof sub !== 'string' || !sub.trim()) {
      throw new Error('INVALID_OR_EXPIRED_TOKEN');
    }

    userId = sub;
  } catch (error) {
    if (error instanceof Error && error.message === 'WEAK_PASSWORD') {
      throw error;
    }
    throw new Error('INVALID_OR_EXPIRED_TOKEN');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true }
  });

  if (!user?.passwordHash) {
    throw new Error('INVALID_OR_EXPIRED_TOKEN');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash }
  });
}
