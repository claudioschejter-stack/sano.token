/** Sends SMS via Twilio when configured; logs in development. */
export async function sendSms(toE164: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    console.warn('[sms] Twilio not configured — message to', toE164, ':', body);
    return process.env.NODE_ENV !== 'production'
      ? { ok: true }
      : { ok: false, error: 'TWILIO_NOT_CONFIGURED' };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const params = new URLSearchParams({ To: toE164, From: from, Body: body });

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
    console.error('[sms] Twilio error', response.status, text);
    return { ok: false, error: `TWILIO_${response.status}` };
  }

  return { ok: true };
}
