import { createHash, randomInt } from 'crypto';
import { prisma, VerificationChannel } from '@sanova/database';
import { sendTransactionalEmail } from '../email/sendTransactionalEmail';
import { sendSms } from '../sms/sendSms';
import { normalizePhoneE164 } from '../auth/contactValidation';
import {
  isSupabaseOtpEnabled,
  sendSupabaseOtp,
  verifySupabaseOtp
} from './supabaseOtp';

export { normalizePhoneE164 };

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_WINDOW_MS = 60 * 60 * 1000;
const MAX_CODES_PER_HOUR = 5;

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateCode(): string {
  return String(randomInt(100000, 999999));
}

async function assertRateLimit(userId: string, channel: VerificationChannel) {
  const since = new Date(Date.now() - MAX_ATTEMPTS_WINDOW_MS);
  const count = await prisma.verificationCode.count({
    where: { userId, channel, createdAt: { gte: since } }
  });

  if (count >= MAX_CODES_PER_HOUR) {
    throw new Error('RATE_LIMIT');
  }
}

export async function issueVerificationCode(
  userId: string,
  channel: VerificationChannel,
  target: string
): Promise<{ devCode?: string; delivered: boolean; deliveryError?: string }> {
  await assertRateLimit(userId, channel);

  if (isSupabaseOtpEnabled()) {
    const result = await sendSupabaseOtp(channel, target);

    if (!result.ok) {
      console.warn('[verification] supabase delivery failed for', channel, target, result.error);
      return {
        delivered: false,
        deliveryError:
          result.error ?? (channel === 'EMAIL' ? 'EMAIL_DELIVERY_FAILED' : 'SMS_DELIVERY_FAILED')
      };
    }

    return { delivered: true };
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.verificationCode.updateMany({
    where: { userId, channel, consumedAt: null },
    data: { consumedAt: new Date() }
  });

  await prisma.verificationCode.create({
    data: {
      userId,
      channel,
      target,
      codeHash: hashCode(code),
      expiresAt
    }
  });

  let delivered = false;
  let deliveryError: string | undefined;

  if (channel === 'EMAIL') {
    const result = await sendTransactionalEmail({
      to: target,
      subject: 'Código de verificación — Sanova Global',
      text: `Tu código de verificación es: ${code}\n\nVálido por 10 minutos. Si no solicitaste este código, ignorá este mensaje.`,
      html: `<p>Tu código de verificación es:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>Válido por 10 minutos.</p>`
    });
    delivered = result.ok;
    deliveryError = result.error;

    if (!delivered) {
      console.warn('[verification] email delivery failed for', target, deliveryError);
    }
  } else {
    const result = await sendSms(
      target,
      `Sanova Global: tu código de verificación es ${code}. Válido 10 min.`
    );
    delivered = result.ok;
    deliveryError = result.error;

    if (!delivered) {
      console.warn('[verification] sms delivery failed for', target, deliveryError);
    }
  }

  const exposeDevCode =
    process.env.ONBOARDING_DEV_EXPOSE_CODE === 'true' || process.env.NODE_ENV !== 'production';

  return {
    delivered,
    deliveryError,
    ...(exposeDevCode ? { devCode: code } : {})
  };
}

export async function consumeVerificationCode(
  userId: string,
  channel: VerificationChannel,
  code: string
): Promise<boolean> {
  if (isSupabaseOtpEnabled()) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true }
    });

    const target = channel === 'EMAIL' ? user?.email : user?.phone;

    if (!target) {
      return false;
    }

    const result = await verifySupabaseOtp(channel, target, code);
    return result.ok;
  }

  const record = await prisma.verificationCode.findFirst({
    where: {
      userId,
      channel,
      consumedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!record || record.codeHash !== hashCode(code.trim())) {
    return false;
  }

  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() }
  });

  return true;
}
