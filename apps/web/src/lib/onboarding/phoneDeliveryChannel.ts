import { sendSms } from '../sms/sendSms';
import { sendWhatsApp } from '../sms/sendWhatsApp';

export type PhoneDeliveryChannel = 'sms' | 'whatsapp';

export function getPhoneDeliveryChannel(): PhoneDeliveryChannel {
  const explicit = process.env.ONBOARDING_PHONE_CHANNEL?.trim().toLowerCase();

  if (explicit === 'sms') {
    return 'sms';
  }

  if (explicit === 'whatsapp') {
    return 'whatsapp';
  }

  if (process.env.TWILIO_WHATSAPP_NUMBER?.trim()) {
    return 'whatsapp';
  }

  return 'sms';
}

export function isWhatsAppPhoneVerificationEnabled(): boolean {
  return getPhoneDeliveryChannel() === 'whatsapp';
}

export async function sendPhoneVerificationMessage(
  toE164: string,
  code: string
): Promise<{ ok: boolean; error?: string; channel: PhoneDeliveryChannel }> {
  const channel = getPhoneDeliveryChannel();
  const message =
    channel === 'whatsapp'
      ? `Sanova Global: tu código de verificación WhatsApp es ${code}. Válido 10 min.`
      : `Sanova Global: tu código de verificación es ${code}. Válido 10 min.`;

  const result = channel === 'whatsapp' ? await sendWhatsApp(toE164, message) : await sendSms(toE164, message);

  return { ...result, channel };
}

export function phoneDeliveryFailureCode(channel: PhoneDeliveryChannel = getPhoneDeliveryChannel()): string {
  return channel === 'whatsapp' ? 'WHATSAPP_DELIVERY_FAILED' : 'SMS_DELIVERY_FAILED';
}
