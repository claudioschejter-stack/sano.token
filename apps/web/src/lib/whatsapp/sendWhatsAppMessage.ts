import { normalizePhoneE164 } from '../auth/contactValidation';

export type SendWhatsAppResult = {
  ok: boolean;
  error?: string;
  sid?: string;
};

function getTwilioWhatsAppFrom(): string | null {
  const raw =
    process.env.TWILIO_WHATSAPP_NUMBER?.trim() || process.env.TWILIO_PHONE_NUMBER?.trim();
  if (!raw) {
    return null;
  }

  if (raw.startsWith('whatsapp:')) {
    return raw;
  }

  if (raw.startsWith('+')) {
    return `whatsapp:${raw}`;
  }

  const digits = raw.replace(/\D/g, '');
  return digits ? `whatsapp:+${digits}` : null;
}

function mapTwilioError(status: number, body: string): string {
  if (status === 401 || status === 403) {
    return 'TWILIO_AUTH_FAILED';
  }
  if (body.includes('63016') || body.includes('63007') || body.toLowerCase().includes('template')) {
    return 'WHATSAPP_TEMPLATE_REQUIRED';
  }
  if (body.includes('63015') || body.toLowerCase().includes('sandbox')) {
    return 'WHATSAPP_SANDBOX_REQUIRED';
  }
  return `TWILIO_${status}`;
}

export async function sendWhatsAppMessage(input: {
  to: string;
  body: string;
  contentSid?: string | null;
  contentVariables?: Record<string, string>;
}): Promise<SendWhatsAppResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = getTwilioWhatsAppFrom();

  if (!accountSid || !authToken || !from) {
    console.warn('[whatsapp] Twilio WhatsApp not configured — skipping send');
    return { ok: false, error: 'TWILIO_WHATSAPP_NOT_CONFIGURED' };
  }

  const toE164 = normalizePhoneE164(input.to);
  if (!toE164) {
    return { ok: false, error: 'INVALID_PHONE' };
  }

  const to = `whatsapp:${toE164}`;
  const contentSid =
    input.contentSid?.trim() || process.env.TWILIO_WHATSAPP_INVITE_CONTENT_SID?.trim() || '';

  const params = new URLSearchParams();
  params.set('From', from);
  params.set('To', to);

  if (contentSid) {
    params.set('ContentSid', contentSid);
    const variables = input.contentVariables ?? { 1: input.body };
    params.set('ContentVariables', JSON.stringify(variables));
  } else {
    params.set('Body', input.body);
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('[whatsapp] Twilio error', response.status, body);
    return { ok: false, error: mapTwilioError(response.status, body) };
  }

  const data = (await response.json()) as { sid?: string };
  return { ok: true, sid: data.sid };
}

export async function sendInviteWhatsAppMessage(input: {
  phone?: string | null;
  message: string;
  acceptUrl: string;
  recipientName?: string | null;
}): Promise<{ sent: boolean; error?: string }> {
  if (!input.phone?.trim()) {
    return { sent: false };
  }

  const result = await sendWhatsAppMessage({
    to: input.phone,
    body: input.message,
    contentVariables: {
      1: input.recipientName?.trim() || 'Cliente',
      2: input.acceptUrl
    }
  });

  if (!result.ok) {
    console.warn('[whatsapp] invite delivery failed', input.phone, result.error);
  }

  return { sent: result.ok, error: result.error };
}

export function isWhatsAppApiConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      getTwilioWhatsAppFrom()
  );
}
