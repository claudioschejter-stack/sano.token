import { sendWhatsAppMessage } from './twilioWhatsApp';

/** Sends WhatsApp messages via Twilio when configured; logs in development. */
export async function sendWhatsApp(toE164: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const result = await sendWhatsAppMessage(toE164, body);
  return { ok: result.ok, error: result.error };
}
