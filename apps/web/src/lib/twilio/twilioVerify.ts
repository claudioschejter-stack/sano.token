type TwilioVerifyResult = { ok: true } | { ok: false; error: string };

function getTwilioCredentials(): { accountSid: string; authToken: string; serviceSid: string } | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();

  if (!accountSid || !authToken || !serviceSid) {
    return null;
  }

  return { accountSid, authToken, serviceSid };
}

function mapTwilioVerifyError(status: number, body: string): string {
  if (status === 401 || status === 403) {
    return 'TWILIO_AUTH_FAILED';
  }
  if (body.includes('60200') || body.includes('Invalid parameter')) {
    return 'INVALID_PHONE';
  }
  if (body.includes('60203') || body.includes('Max send attempts')) {
    return 'RATE_LIMIT';
  }
  return 'WHATSAPP_DELIVERY_FAILED';
}

export async function sendTwilioVerifyCode(phoneE164: string): Promise<TwilioVerifyResult> {
  const creds = getTwilioCredentials();
  if (!creds) {
    return { ok: false, error: 'TWILIO_WHATSAPP_NOT_CONFIGURED' };
  }

  const channel = process.env.TWILIO_VERIFY_CHANNEL?.trim() || 'whatsapp';

  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${creds.serviceSid}/Verifications`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ To: phoneE164, Channel: channel }).toString()
    }
  );

  if (!response.ok) {
    const body = await response.text();
    console.warn('[twilio-verify] send failed', response.status, body);
    return { ok: false, error: mapTwilioVerifyError(response.status, body) };
  }

  return { ok: true };
}

export async function checkTwilioVerifyCode(phoneE164: string, code: string): Promise<TwilioVerifyResult> {
  const creds = getTwilioCredentials();
  if (!creds) {
    return { ok: false, error: 'TWILIO_WHATSAPP_NOT_CONFIGURED' };
  }

  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${creds.serviceSid}/VerificationCheck`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ To: phoneE164, Code: code.trim() }).toString()
    }
  );

  if (!response.ok) {
    const body = await response.text();
    console.warn('[twilio-verify] check failed', response.status, body);
    return { ok: false, error: mapTwilioVerifyError(response.status, body) };
  }

  const data = (await response.json()) as { status?: string };
  if (data.status !== 'approved') {
    return { ok: false, error: 'INVALID_CODE' };
  }

  return { ok: true };
}

export function twilioVerifyConfigured(): boolean {
  return getTwilioCredentials() !== null;
}
