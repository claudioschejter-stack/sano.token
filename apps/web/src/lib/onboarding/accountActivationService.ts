import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '@sanova/database';
import { sendTransactionalEmail } from '../email/sendTransactionalEmail';
import type { RegistrationChannel } from '../auth/registrationAttemptService';
import { issueAuthUserById } from '../auth/issueAuthUser';
import { loadAccountOperational } from '../auth/sessionClaims';

const ACTIVATION_TTL = '24h';
const LOGIN_GRANT_TTL = '5m';

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

export function siteBaseUrl(): string {
  const fromPublic = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromPublic) {
    return fromPublic.replace(/\/$/, '');
  }

  const fromAuth = process.env.AUTH_URL?.trim();
  if (fromAuth) {
    return fromAuth.replace(/\/$/, '');
  }

  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim()}`;
  }

  return 'https://www.sanovacapital.com';
}

async function signActivationToken(userId: string): Promise<string> {
  return new SignJWT({ purpose: 'account-activation' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ACTIVATION_TTL)
    .sign(authSecret());
}

async function signActivationLoginGrant(userId: string): Promise<string> {
  return new SignJWT({ purpose: 'activation-login' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(LOGIN_GRANT_TTL)
    .sign(authSecret());
}

export async function sendAccountActivationEmail(input: {
  userId: string;
  email: string;
  channel?: RegistrationChannel;
}): Promise<{ delivered: boolean; devActivationUrl?: string }> {
  const token = await signActivationToken(input.userId);
  const activationUrl = `${siteBaseUrl()}/acceso/activar?token=${encodeURIComponent(token)}`;

  const result = await sendTransactionalEmail({
    to: input.email,
    subject: 'Activá tu cuenta — Sanova Global',
    text: [
      'Gracias por registrarte en Sanova Global.',
      '',
      'Activá tu cuenta con este enlace (válido 24 horas):',
      activationUrl,
      '',
      'Si no creaste esta cuenta, ignorá este mensaje.',
      '',
      'Sanova Global'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
        <p>Gracias por registrarte en Sanova Global.</p>
        <p style="margin:24px 0">
          <a href="${activationUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:700">
            Activá tu cuenta
          </a>
        </p>
        <p style="color:#475569;font-size:14px">El enlace vence en 24 horas. Si no creaste esta cuenta, ignorá este mensaje.</p>
        <p style="color:#475569;font-size:14px">Sanova Global</p>
      </div>
    `
  });

  const exposeDev =
    process.env.ONBOARDING_DEV_EXPOSE_CODE === 'true' || process.env.NODE_ENV !== 'production';

  if (!result.ok) {
    console.warn('[account-activation] email delivery failed for', input.email, result.error);
    if (exposeDev) {
      console.info('[account-activation] dev activation url:', activationUrl);
      return { delivered: false, devActivationUrl: activationUrl };
    }
    return { delivered: false };
  }

  if (input.channel && input.channel !== 'unknown') {
    await prisma.user.update({
      where: { id: input.userId },
      data: { registrationChannel: input.channel }
    });
  }

  return { delivered: true, devActivationUrl: exposeDev ? activationUrl : undefined };
}

export async function resendAccountActivationEmail(email: string): Promise<{ ok: true; devActivationUrl?: string }> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, email: true, emailVerifiedAt: true, passwordHash: true, registrationChannel: true }
  });

  if (!user?.passwordHash || user.emailVerifiedAt) {
    return { ok: true };
  }

  const channel = (user.registrationChannel ?? 'unknown') as RegistrationChannel;
  const result = await sendAccountActivationEmail({
    userId: user.id,
    email: user.email,
    channel
  });

  return { ok: true, devActivationUrl: result.devActivationUrl };
}

export async function activateAccountWithToken(token: string): Promise<{
  loginToken: string;
  email: string;
  registrationChannel: string | null;
}> {
  let userId: string;

  try {
    const verified = await jwtVerify(token.trim(), authSecret());
    const purpose = verified.payload.purpose;
    const sub = verified.payload.sub;

    if (purpose !== 'account-activation' || typeof sub !== 'string' || !sub.trim()) {
      throw new Error('INVALID_OR_EXPIRED_TOKEN');
    }

    userId = sub;
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_OR_EXPIRED_TOKEN') {
      throw error;
    }
    throw new Error('INVALID_OR_EXPIRED_TOKEN');
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerifiedAt: new Date()
    },
    select: {
      id: true,
      email: true,
      registrationChannel: true
    }
  });

  const loginToken = await signActivationLoginGrant(user.id);

  return {
    loginToken,
    email: user.email,
    registrationChannel: user.registrationChannel
  };
}

export async function verifyActivationLoginGrant(loginToken: string) {
  let userId: string;

  try {
    const verified = await jwtVerify(loginToken.trim(), authSecret());
    const purpose = verified.payload.purpose;
    const sub = verified.payload.sub;

    if (purpose !== 'activation-login' || typeof sub !== 'string' || !sub.trim()) {
      return null;
    }

    userId = sub;
  } catch {
    return null;
  }

  const authUser = await issueAuthUserById(userId);
  if (!authUser) {
    return null;
  }

  return {
    id: authUser.id,
    email: authUser.email,
    role: authUser.role,
    roles: authUser.roles,
    accessToken: authUser.accessToken,
    accountOperational: await loadAccountOperational(authUser.id)
  };
}
