type TwilioResult = { ok: boolean; error?: string; provider?: string };

function twilioCredentials(): { accountSid: string; authToken: string } | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();

  if (!accountSid || !authToken) {
    return null;
  }

  return { accountSid, authToken };
}

function basicAuthHeader(accountSid: string, authToken: string): string {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
}

export function resolveWhatsAppFromNumber(): string | null {
  const raw =
    process.env.TWILIO_WHATSAPP_NUMBER?.trim() ||
    process.env.TWILIO_WHATSAPP_FROM?.trim() ||
    process.env.TWILIO_PHONE_NUMBER?.trim();

  if (!raw) {
    return null;
  }

  const digits = raw.replace(/^whatsapp:/i, '').trim();
  if (!digits) {
    return null;
  }

  return digits.startsWith('+') ? digits : `+${digits.replace(/\D/g, '')}`;
}

export function isTwilioVerifyWhatsAppEnabled(): boolean {
  return Boolean(process.env.TWILIO_VERIFY_SERVICE_SID?.trim() && twilioCredentials());
}

export function isTwilioWhatsAppConfigured(): boolean {
  return Boolean(twilioCredentials() && (resolveWhatsAppFromNumber() || isTwilioVerifyWhatsAppEnabled()));
}

function normalizeWhatsAppTo(toE164: string): string {
  const trimmed = toE164.trim();
  if (trimmed.startsWith('whatsapp:')) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, '');
  return `whatsapp:+${digits}`;
}

function parseTwilioError(status: number, text: string): string {
  try {
    const payload = JSON.parse(text) as { code?: number; message?: string };
    if (payload.message) {
      console.error('[whatsapp] Twilio error', status, payload.code, payload.message);
      if (payload.code === 63016) {
        return 'WHATSAPP_TEMPLATE_REQUIRED';
      }
      if (payload.code === 63015) {
        return 'WHATSAPP_SANDBOX_REQUIRED';
      }
      return 'WHATSAPP_DELIVERY_FAILED';
    }
  } catch {
    console.error('[whatsapp] Twilio error', status, text);
  }

  return status === 401 || status === 403 ? 'TWILIO_AUTH_FAILED' : 'WHATSAPP_DELIVERY_FAILED';
}

export async function startWhatsAppVerification(toE164: string): Promise<TwilioResult> {
  const credentials = twilioCredentials();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();

  if (!credentials || !serviceSid) {
    return { ok: false, error: 'TWILIO_WHATSAPP_NOT_CONFIGURED' };
  }

  const response = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(credentials.accountSid, credentials.authToken),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      To: toE164.startsWith('+') ? toE164 : `+${toE164.replace(/\D/g, '')}`,
      Channel: 'whatsapp'
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return { ok: false, error: parseTwilioError(response.status, text), provider: 'twilio_verify' };
  }

  return { ok: true, provider: 'twilio_verify' };
}

export async function checkWhatsAppVerification(toE164: string, code: string): Promise<TwilioResult> {
  const credentials = twilioCredentials();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();

  if (!credentials || !serviceSid) {
    return { ok: false, error: 'TWILIO_WHATSAPP_NOT_CONFIGURED' };
  }

  const response = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(credentials.accountSid, credentials.authToken),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      To: toE164.startsWith('+') ? toE164 : `+${toE164.replace(/\D/g, '')}`,
      Code: code.trim()
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return { ok: false, error: parseTwilioError(response.status, text), provider: 'twilio_verify' };
  }

  const payload = (await response.json()) as { status?: string };
  if (payload.status !== 'approved') {
    return { ok: false, error: 'INVALID_CODE', provider: 'twilio_verify' };
  }

  return { ok: true, provider: 'twilio_verify' };
}

export async function sendWhatsAppMessage(toE164: string, body: string): Promise<TwilioResult> {
  const credentials = twilioCredentials();
  const fromNumber = resolveWhatsAppFromNumber();
  const contentSid = process.env.TWILIO_WHATSAPP_OTP_CONTENT_SID?.trim();

  if (!credentials || !fromNumber) {
    console.warn('[whatsapp] Twilio WhatsApp not configured — message to', toE164, ':', body);
    return process.env.NODE_ENV !== 'production'
      ? { ok: true, provider: 'dev_stub' }
      : { ok: false, error: 'TWILIO_WHATSAPP_NOT_CONFIGURED' };
  }

  const from = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;
  const to = normalizeWhatsAppTo(toE164);
  const params = new URLSearchParams({ To: to, From: from });

  if (contentSid) {
    const otpMatch = body.match(/\b(\d{6})\b/);
    params.set('ContentSid', contentSid);
    params.set('ContentVariables', JSON.stringify({ '1': otpMatch?.[1] ?? body }));
  } else {
    params.set('Body', body);
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(credentials.accountSid, credentials.authToken),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return { ok: false, error: parseTwilioError(response.status, text), provider: 'twilio_messages' };
  }

  return { ok: true, provider: 'twilio_messages' };
}
