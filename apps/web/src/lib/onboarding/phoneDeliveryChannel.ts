import { sendWhatsApp } from '../sms/sendWhatsApp';

export async function sendPhoneVerificationMessage(
  toE164: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  const message = `Sanova Global: tu código de verificación WhatsApp es ${code}. Válido 10 min.`;
  return sendWhatsApp(toE164, message);
}

export function phoneDeliveryFailureCode(): string {
  return 'WHATSAPP_DELIVERY_FAILED';
}
