import { createHash, randomInt } from 'crypto';
import { prisma, VerificationChannel } from '@sanova/database';
import { sendTransactionalEmail } from '../email/sendTransactionalEmail';
import {
  getPhoneDeliveryChannel,
  isWhatsAppPhoneVerificationEnabled,
  phoneDeliveryFailureCode,
  sendPhoneVerificationMessage
} from './phoneDeliveryChannel';
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

  if (channel === 'PHONE' && isSupabaseOtpEnabled() && !isWhatsAppPhoneVerificationEnabled()) {
    const result = await sendSupabaseOtp(channel, target);

    if (!result.ok) {
      console.warn('[verification] supabase delivery failed for', channel, target, result.error);
      return {
        delivered: false,
        deliveryError: result.error ?? phoneDeliveryFailureCode('sms')
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
      subject: `Tu código de verificación Sanova es ${code}`,
      text: [
        `Tu código de verificación Sanova es: ${code}`,
        '',
        'Este código vence en 10 minutos.',
        'Si no solicitaste este acceso, podés ignorar este mensaje.',
        '',
        'Sanova Capital'
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
          <p>Tu código de verificación Sanova es:</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${code}</p>
          <p>Este código vence en 10 minutos.</p>
          <p style="color:#475569;font-size:14px">Si no solicitaste este acceso, podés ignorar este mensaje.</p>
          <p style="color:#475569;font-size:14px">Sanova Capital</p>
        </div>
      `
    });
    delivered = result.ok;
    deliveryError = result.error;

    if (!delivered) {
      console.warn('[verification] email delivery failed for', target, deliveryError);
    }
  } else {
    const result = await sendPhoneVerificationMessage(target, code);
    delivered = result.ok;
    deliveryError = result.error ?? (delivered ? undefined : phoneDeliveryFailureCode(result.channel));

    if (!delivered) {
      console.warn('[verification] phone delivery failed for', target, deliveryError, result.channel);
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
  if (channel === 'PHONE' && isSupabaseOtpEnabled() && !isWhatsAppPhoneVerificationEnabled()) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true }
    });

    const target = user?.phone;

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
