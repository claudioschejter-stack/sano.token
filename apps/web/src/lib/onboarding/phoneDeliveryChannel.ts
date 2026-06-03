import {
  checkWhatsAppVerification,
  isTwilioVerifyWhatsAppEnabled,
  isTwilioWhatsAppConfigured,
  sendWhatsAppMessage,
  startWhatsAppVerification
} from '../sms/twilioWhatsApp';

export async function sendPhoneVerificationMessage(
  toE164: string,
  code: string
): Promise<{ ok: boolean; error?: string; usesVerify?: boolean }> {
  if (isTwilioVerifyWhatsAppEnabled()) {
    const result = await startWhatsAppVerification(toE164);
    return { ok: result.ok, error: result.error, usesVerify: true };
  }

  const message = `Sanova Global: tu código de verificación WhatsApp es ${code}. Válido 10 min.`;
  const result = await sendWhatsAppMessage(toE164, message);
  return { ok: result.ok, error: result.error, usesVerify: false };
}

export async function verifyPhoneVerificationCode(
  toE164: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  if (isTwilioVerifyWhatsAppEnabled()) {
    return checkWhatsAppVerification(toE164, code);
  }

  return { ok: false, error: 'INVALID_CODE' };
}

export function phoneDeliveryFailureCode(error?: string): string {
  if (error === 'TWILIO_WHATSAPP_NOT_CONFIGURED') {
    return 'TWILIO_WHATSAPP_NOT_CONFIGURED';
  }
  if (error === 'WHATSAPP_SANDBOX_REQUIRED') {
    return 'WHATSAPP_SANDBOX_REQUIRED';
  }
  if (error === 'WHATSAPP_TEMPLATE_REQUIRED') {
    return 'WHATSAPP_TEMPLATE_REQUIRED';
  }
  if (error === 'TWILIO_AUTH_FAILED') {
    return 'TWILIO_AUTH_FAILED';
  }
  return 'WHATSAPP_DELIVERY_FAILED';
}

export { isTwilioWhatsAppConfigured, isTwilioVerifyWhatsAppEnabled };
