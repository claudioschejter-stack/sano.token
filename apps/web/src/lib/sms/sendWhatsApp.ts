/** Sends WhatsApp messages via Twilio when configured; logs in development. */
export async function sendWhatsApp(toE164: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromRaw = process.env.TWILIO_WHATSAPP_NUMBER?.trim();

  if (!accountSid || !authToken || !fromRaw) {
    console.warn('[whatsapp] Twilio WhatsApp not configured — message to', toE164, ':', body);
    return process.env.NODE_ENV !== 'production'
      ? { ok: true }
      : { ok: false, error: 'TWILIO_WHATSAPP_NOT_CONFIGURED' };
  }

  const from = fromRaw.startsWith('whatsapp:') ? fromRaw : `whatsapp:${fromRaw}`;
  const to = toE164.startsWith('whatsapp:') ? toE164 : `whatsapp:${toE164}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const params = new URLSearchParams({ To: to, From: from, Body: body });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error('[whatsapp] Twilio error', response.status, text);
    return { ok: false, error: `TWILIO_WHATSAPP_${response.status}` };
  }

  return { ok: true };
}
